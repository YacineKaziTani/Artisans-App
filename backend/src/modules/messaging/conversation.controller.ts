import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Conversation } from "./conversation.entities";
import { Message } from "./message.entities";
import { Shop } from "../shop/shop.entities";
import {
  isUuid,
  pageResult,
  parsePagination,
  queryString,
} from "../../middleware/validate.middleware";
import { User } from "../users/entities/user.entities";
import { MAX_MESSAGE_LENGTH } from "./message.limits";
import { broadcastNewMessage } from "../../realtime/socket";
import { destroyUpload, type CloudinaryFile } from "../../lib/uploads";

export { MAX_MESSAGE_LENGTH };

const MESSAGE_PAGE_SIZE = 50;

/**
 * One page of a thread, oldest-to-newest, plus whether older messages
 * exist. `?before=<messageId>` pages backwards from that message. Threads
 * used to be loaded in full on every open.
 *
 * The cursor is compared as (createdAt, id) in SQL — at the database's
 * microsecond precision — rather than as a JS timestamp, which is only
 * millisecond-precise and could skip messages sharing a millisecond.
 */
async function loadMessagePage(
  conversationId: string,
  query: Request["query"],
) {
  const limit = Math.min(
    Math.max(Math.floor(Number(query.limit)) || MESSAGE_PAGE_SIZE, 1),
    100,
  );
  const before = queryString(query.before);

  const qb = messageRepo
    .createQueryBuilder("m")
    .leftJoinAndSelect("m.sender", "sender")
    .where("m.conversationId = :conversationId", { conversationId });
  if (before && isUuid(before)) {
    qb.andWhere(
      `(m.createdAt, m.id) < (SELECT "createdAt", "id" FROM "messages" WHERE "id" = :before)`,
      { before },
    );
  }

  const newestFirst = await qb
    .orderBy("m.createdAt", "DESC")
    .addOrderBy("m.id", "DESC")
    .limit(limit + 1) // one extra row tells us whether there's more
    .getMany();

  return {
    messages: newestFirst.slice(0, limit).reverse(),
    hasMore: newestFirst.length > limit,
  };
}

const conversationRepo = AppDataSource.getRepository(Conversation);
const messageRepo = AppDataSource.getRepository(Message);
const shopRepo = AppDataSource.getRepository(Shop);

async function isParticipant(conversation: Conversation, userId: string) {
  return (
    conversation.client.id === userId || conversation.shop.owner.id === userId
  );
}

async function unreadCountsFor(conversationIds: string[], viewerId: string) {
  if (conversationIds.length === 0) return new Map<string, number>();

  const rows = await messageRepo
    .createQueryBuilder("message")
    .select("message.conversationId", "conversationId")
    .addSelect("COUNT(*)", "count")
    .where("message.conversationId IN (:...conversationIds)", {
      conversationIds,
    })
    .andWhere("message.senderId != :viewerId", { viewerId })
    .andWhere("message.readAt IS NULL")
    .groupBy("message.conversationId")
    .getRawMany<{ conversationId: string; count: string }>();

  return new Map(rows.map((r) => [r.conversationId, Number(r.count)]));
}

export async function findConversationForParticipant(
  conversationId: string,
  userId: string,
) {
  const conversation = await conversationRepo.findOne({
    where: { id: conversationId },
    relations: ["client", "shop", "shop.owner"],
  });
  if (!conversation) return { conversation: null, allowed: false };
  return { conversation, allowed: await isParticipant(conversation, userId) };
}

export async function persistMessage(
  conversation: Conversation,
  userId: string,
  content: string,
  extra: { attachments?: { url: string; publicId: string }[]; isAutomatic?: boolean } = {},
) {
  const message = messageRepo.create({
    conversation,
    sender: { id: userId } as User,
    content: content.trim(),
    attachments: extra.attachments?.length ? extra.attachments : null,
    isAutomatic: extra.isAutomatic ?? false,
  });
  await messageRepo.save(message);

  // Only the timestamp: save() would write back every field of this
  // in-memory copy, undoing changes made since it was loaded (such as the
  // holiday auto-reply marker).
  conversation.updatedAt = new Date();
  await conversationRepo.update(conversation.id, { updatedAt: conversation.updatedAt });

  return messageRepo.findOne({
    where: { id: message.id },
    relations: ["sender"],
  });
}

/**
 * Saves a message, pushes it to whoever has the thread open, and — if the
 * client wrote to a shop that's away — sends the shop's automatic reply
 * (once per conversation per holiday).
 */
export async function deliverMessage(
  conversation: Conversation,
  senderId: string,
  content: string,
  attachments?: { url: string; publicId: string }[],
) {
  const saved = await persistMessage(conversation, senderId, content, { attachments });
  broadcastNewMessage(conversation.id, saved, otherParticipantId(conversation, senderId));
  const auto = await holidayAutoReply(conversation, senderId);
  if (auto) broadcastNewMessage(conversation.id, auto, conversation.client.id);
  return saved;
}

async function holidayAutoReply(conversation: Conversation, senderId: string) {
  const shop = conversation.shop;
  if (senderId !== conversation.client.id || !shop.owner) return null;
  if (!shop.holidayUntil || shop.holidayUntil.getTime() <= Date.now()) return null;
  // Claim the reply first so two quick messages can't both trigger one.
  // Both timestamps come from this server's clock (holidayStartedAt is set
  // the same way), so a database clock that differs can't cause repeats.
  const claimed: unknown[] = await AppDataSource.query(
    `UPDATE conversations SET "autoRepliedAt" = $3
      WHERE id = $1 AND ("autoRepliedAt" IS NULL OR "autoRepliedAt" < $2)
      RETURNING id`,
    [conversation.id, shop.holidayStartedAt ?? new Date(0), new Date()],
  ).then((r) => (Array.isArray(r[0]) ? r[0] : r));
  if (!claimed.length) return null;
  const back = shop.holidayUntil.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: shop.timezone || "UTC",
  });
  const text =
    shop.holidayMessage?.trim() ||
    `Thanks for your message! I'm away until ${back} and will reply when I'm back.`;
  return persistMessage(conversation, shop.owner.id, `${text}\n\n(Automatic reply — back ${back})`, { isAutomatic: true });
}

export function otherParticipantId(
  conversation: Conversation,
  senderId: string,
) {
  return conversation.client.id === senderId
    ? conversation.shop.owner.id
    : conversation.client.id;
}

// Client starts (or resumes) a conversation with a shop.
export const startConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shopId } = req.body;
    if (!shopId) return res.status(400).json({ message: "shopId is required" });

    const shop = await shopRepo.findOne({
      where: { id: shopId },
      relations: ["owner"],
    });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (shop.owner.id === userId) {
      return res
        .status(400)
        .json({ message: "You can't message your own shop" });
    }

    let conversation = await conversationRepo.findOne({
      where: { client: { id: userId }, shop: { id: shopId } },
      relations: ["client", "shop", "shop.owner"],
    });

    if (!conversation) {
      conversation = conversationRepo.create({
        client: { id: userId } as User,
        shop,
      });
      await conversationRepo.save(conversation);
      conversation = await conversationRepo.findOne({
        where: { id: conversation.id },
        relations: ["client", "shop", "shop.owner"],
      });
    }

    return res.status(201).json(conversation);
  } catch (error) {
    console.error("startConversation failed:", error);
    return res.status(500).json({ message: "Error starting conversation" });
  }
};

export const getMyConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const conversations = await conversationRepo
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.client", "client")
      .leftJoinAndSelect("conversation.shop", "shop")
      .leftJoinAndSelect("shop.owner", "owner")
      .where("client.id = :userId", { userId })
      .orWhere("owner.id = :userId", { userId })
      .orderBy("conversation.updatedAt", "DESC")
      .getMany();

    const unread = await unreadCountsFor(
      conversations.map((c) => c.id),
      userId,
    );

    return res.json(
      conversations.map((c) => ({ ...c, unreadCount: unread.get(c.id) ?? 0 })),
    );
  } catch (error) {
    console.error("getMyConversations failed:", error);
    return res.status(500).json({ message: "Error fetching conversations" });
  }
};

export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);

    const conversation = await conversationRepo.findOne({
      where: { id },
      relations: ["client", "shop", "shop.owner"],
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    if (!(await isParticipant(conversation, userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const page = await loadMessagePage(id, req.query);

    // Opening the thread (the newest page) reads everything in it.
    if (!queryString(req.query.before)) {
      await messageRepo
        .createQueryBuilder()
        .update(Message)
        .set({ readAt: new Date() })
        .where("conversationId = :id", { id })
        .andWhere("senderId != :userId", { userId })
        .andWhere("readAt IS NULL")
        .execute();
    }

    return res.json({ conversation, ...page });
  } catch (error) {
    console.error("getConversationMessages failed:", error);
    return res.status(500).json({ message: "Error fetching messages" });
  }
};

// Send a message — participant only.
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ message: "content is required" });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    const { conversation, allowed } = await findConversationForParticipant(
      id,
      userId,
    );
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const saved = await deliverMessage(conversation, userId, content);
    return res.status(201).json(saved);
  } catch (error) {
    console.error("sendMessage failed:", error);
    return res.status(500).json({ message: "Error sending message" });
  }
};

/**
 * POST /conversations/:id/attachments (multipart "image", optional
 * "content" caption) — a photo in the chat.
 */
export const sendAttachment = async (req: Request, res: Response) => {
  const file = req.file as CloudinaryFile | undefined;
  try {
    if (!file?.path) return res.status(400).json({ message: "Choose a photo to send" });
    const userId = req.user!.id;
    const caption = typeof req.body?.content === "string" ? req.body.content : "";
    const refuse = async (status: number, message: string) => {
      await destroyUpload(file.filename);
      return res.status(status).json({ message });
    };
    if (caption.length > MAX_MESSAGE_LENGTH) {
      return refuse(400, `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`);
    }
    const { conversation, allowed } = await findConversationForParticipant(String(req.params.id), userId);
    if (!conversation) return refuse(404, "Conversation not found");
    if (!allowed) return refuse(403, "Forbidden");
    const saved = await deliverMessage(conversation, userId, caption, [
      { url: file.path, publicId: file.filename ?? "" },
    ]);
    return res.status(201).json(saved);
  } catch (error) {
    console.error("sendAttachment failed:", error);
    await destroyUpload(file?.filename);
    return res.status(500).json({ message: "Couldn't send that photo" });
  }
};

export const getAllConversationsAdmin = async (req: Request, res: Response) => {
  try {
    const { page, take, skip } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const [conversations, total] = await conversationRepo.findAndCount({
      relations: ["client", "shop", "shop.owner"],
      order: { updatedAt: "DESC", id: "ASC" },
      skip,
      take,
    });
    return res.json(pageResult(conversations, total, page, take));
  } catch (error) {
    console.error("getAllConversationsAdmin failed:", error);
    return res.status(500).json({ message: "Error fetching conversations" });
  }
};

export const getConversationMessagesAdmin = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = String(req.params.id);

    const conversation = await conversationRepo.findOne({
      where: { id },
      relations: ["client", "shop", "shop.owner"],
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    return res.json({ conversation, ...(await loadMessagePage(id, req.query)) });
  } catch (error) {
    console.error("getConversationMessagesAdmin failed:", error);
    return res.status(500).json({ message: "Error fetching messages" });
  }
};
