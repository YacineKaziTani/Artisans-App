import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { parseCookie } from "cookie";
import {
  findConversationForParticipant,
  deliverMessage,
  MAX_MESSAGE_LENGTH,
} from "../modules/messaging/conversation.controller";
import { UserRole } from "../modules/users/entities/user.entities";
import { resolveSession } from "../middleware/auth.middleware";
import { isUuid } from "../middleware/validate.middleware";
import { allowedOrigins, isAllowedOrigin } from "../lib/urls";
import { emailVerificationRequired } from "../config/email-verification";

interface AuthedSocket extends Socket {
  userId?: string;
  userRole?: UserRole;
  emailVerified?: boolean;
}

type Ack = (res: { ok: boolean; message?: string }) => void;

let io: Server | null = null;

const conversationRoom = (id: string) => `conversation:${id}`;
const userRoom = (id: string) => `user:${id}`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Registers a listener that can never take the process down.
 *
 * Socket.io calls listeners inside process.nextTick and ignores the promise
 * an async listener returns, so a thrown error or a rejected promise
 * (e.g. Postgres rejecting a malformed uuid) becomes an uncaught
 * exception / unhandled rejection — which exits Node. Any client could
 * trigger that, so every handler goes through here.
 */
function safeOn(
  socket: Socket,
  event: string,
  handler: (...args: unknown[]) => unknown,
) {
  socket.on(event, async (...args: unknown[]) => {
    try {
      await handler(...args);
    } catch (err) {
      console.error(`[socket] "${event}" handler failed:`, err);
      const maybeAck = args[args.length - 1];
      if (typeof maybeAck === "function") {
        (maybeAck as Ack)({ ok: false, message: "Something went wrong" });
      }
    }
  });
}

export function initSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins(),
      credentials: true,
    },
    // CORS only covers the HTTP long-polling transport; browsers don't
    // apply it to WebSockets. Without this, any website a signed-in user
    // visited could open a socket with their cookie and read or send their
    // messages (cross-site WebSocket hijacking).
    allowRequest: (req, callback) => {
      callback(null, isAllowedOrigin(req.headers.origin));
    },
  });

  // Same session rules as the HTTP API: suspended users, deleted accounts
  // and sessions issued before a password change are all rejected, and the
  // role comes from the database rather than the (possibly stale) token.
  io.use(async (socket: AuthedSocket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const token = rawCookie ? parseCookie(rawCookie).token : undefined;
      const session = await resolveSession(token);
      if (!session.ok) return next(new Error("Not authenticated"));

      socket.userId = session.user.id;
      socket.userRole = session.user.role;
      socket.emailVerified = session.user.emailVerified;
      next();
    } catch (err) {
      console.error("[socket] handshake failed:", err);
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const userId = socket.userId!;
    const sendWindow = { start: Date.now(), count: 0 };
    const SEND_LIMIT = 30;
    const SEND_WINDOW_MS = 10_000;

    socket.join(userRoom(userId));
    if (socket.userRole === UserRole.SUPER_ADMIN) {
      socket.join("admins");
    }

    safeOn(socket, "join_conversation", async (conversationId) => {
      if (!isUuid(conversationId)) return;
      const { conversation, allowed } = await findConversationForParticipant(
        conversationId,
        userId,
      );
      if (conversation && allowed) {
        socket.join(conversationRoom(conversationId));
      }
    });

    safeOn(socket, "leave_conversation", (conversationId) => {
      if (!isUuid(conversationId)) return;
      socket.leave(conversationRoom(conversationId));
    });

    safeOn(socket, "send_message", async (payload, maybeAck) => {
      const ack: Ack = typeof maybeAck === "function" ? (maybeAck as Ack) : () => {};

      if (!isPlainObject(payload) || !isUuid(payload.conversationId)) {
        return ack({ ok: false, message: "Conversation not found" });
      }
      if (emailVerificationRequired && !socket.emailVerified) {
        return ack({ ok: false, message: "Please confirm your email address before sending messages" });
      }
      const { conversationId, content } = payload;
      if (typeof content !== "string" || !content.trim()) {
        return ack({ ok: false, message: "content is required" });
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        return ack({
          ok: false,
          message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`,
        });
      }

      const now = Date.now();
      if (now - sendWindow.start > SEND_WINDOW_MS) {
        sendWindow.start = now;
        sendWindow.count = 0;
      }
      if (++sendWindow.count > SEND_LIMIT) {
        return ack({ ok: false, message: "You're sending messages too quickly" });
      }

      const { conversation, allowed } = await findConversationForParticipant(
        conversationId,
        userId,
      );
      if (!conversation) {
        return ack({ ok: false, message: "Conversation not found" });
      }
      if (!allowed) {
        return ack({ ok: false, message: "Forbidden" });
      }

      await deliverMessage(conversation, userId, content);
      ack({ ok: true });
    });

    safeOn(socket, "typing", (payload) => {
      if (!isPlainObject(payload) || !isUuid(payload.conversationId)) return;
      const room = conversationRoom(payload.conversationId);
      // Only participants who have joined (and so passed the participant
      // check in join_conversation) may broadcast into the room.
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit("typing", {
        userId,
        isTyping: payload.isTyping === true,
      });
    });
  });

  return io;
}

/**
 * Disconnects every socket and closes the HTTP server Socket.io is attached
 * to (which stops new requests and waits for in-flight ones). Used on
 * shutdown.
 */
export function closeSocketServer(): Promise<void> {
  const server = io;
  io = null;
  if (!server) return Promise.resolve();
  return new Promise((resolve) => {
    server.close((err) => {
      if (err) console.error("[socket] close error:", err);
      resolve();
    });
  });
}

/**
 * Force-disconnects every live socket belonging to a user — call it when
 * their access changes (suspended, deleted, role changed, password changed)
 * so an already-open connection can't outlive the change. The frontend
 * reconnects once after a server-side disconnect; that goes through the
 * handshake again, so it only succeeds if they're still allowed in.
 */
export function disconnectUserSockets(userId: string) {
  io?.in(userRoom(userId)).disconnectSockets(true);
}

/**
 * A new message in a conversation: to everyone with the thread open, and a
 * nudge to the recipient's (and admins') conversation lists.
 */
export function broadcastNewMessage(conversationId: string, message: unknown, recipientId: string) {
  if (!io) return;
  io.to(conversationRoom(conversationId)).emit("new_message", { conversationId, message });
  io.to(userRoom(recipientId)).emit("conversation_updated", { conversationId });
  io.to("admins").emit("conversation_updated", { conversationId });
}

/** Pushes an event to every open tab of one user (no-op without a socket server, e.g. in tests). */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}
