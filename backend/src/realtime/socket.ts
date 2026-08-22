import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { parseCookie } from "cookie";
import {
  findConversationForParticipant,
  persistMessage,
  otherParticipantId,
} from "../modules/messaging/conversation.controller";
import { UserRole } from "../modules/users/entities/user.entities";

interface AuthedSocket extends Socket {
  userId?: string;
  userRole?: UserRole;
}

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  // Auth handshake: same JWT cookie the REST API uses, since the frontend
  // already sends it automatically (withCredentials) — no separate token
  // flow needed for sockets.
  io.use((socket: AuthedSocket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) return next(new Error("Not authenticated"));

      const { token } = parseCookie(rawCookie);
      if (!token) return next(new Error("Not authenticated"));

      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        sub: string;
        role: UserRole;
      };
      socket.userId = payload.sub;
      socket.userRole = payload.role;
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const userId = socket.userId!;

    // Personal room — lets us push conversation-list updates to a user
    // regardless of which (if any) conversation thread they currently have
    // open, e.g. so their inbox re-sorts/badges live.
    socket.join(`user:${userId}`);
    if (socket.userRole === UserRole.SUPER_ADMIN) {
      socket.join("admins");
    }

    socket.on("join_conversation", async (conversationId: string) => {
      const { conversation, allowed } = await findConversationForParticipant(
        conversationId,
        userId,
      );
      if (conversation && allowed) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("leave_conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      "send_message",
      async (
        payload: { conversationId: string; content: string },
        ack?: (res: { ok: boolean; message?: string }) => void,
      ) => {
        try {
          const { conversationId, content } = payload;
          if (!content?.trim()) {
            return ack?.({ ok: false, message: "content is required" });
          }

          const { conversation, allowed } = await findConversationForParticipant(
            conversationId,
            userId,
          );
          if (!conversation) {
            return ack?.({ ok: false, message: "Conversation not found" });
          }
          if (!allowed) {
            return ack?.({ ok: false, message: "Forbidden" });
          }

          const saved = await persistMessage(conversation, userId, content);

          io!.to(`conversation:${conversationId}`).emit("new_message", {
            conversationId,
            message: saved,
          });

          // Notify the other participant's personal room too, in case they
          // don't have this thread open (updates their inbox list/badge).
          const otherId = otherParticipantId(conversation, userId);
          io!.to(`user:${otherId}`).emit("conversation_updated", {
            conversationId,
          });
          io!.to("admins").emit("conversation_updated", { conversationId });

          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false, message: "Failed to send message" });
        }
      },
    );

    socket.on(
      "typing",
      (payload: { conversationId: string; isTyping: boolean }) => {
        socket
          .to(`conversation:${payload.conversationId}`)
          .emit("typing", { userId, isTyping: payload.isTyping });
      },
    );
  });

  return io;
}

export function getIO() {
  return io;
}
