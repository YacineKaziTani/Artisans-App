import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth.store";
import { appendMessage, conversationKeys } from "@/hooks/useConversations";
import { notificationKeys } from "@/hooks/useNotifications";
import type { MessagePage } from "@/api/conversation.api";
import type { ChatMessage } from "@/types";

export function useSocketConnection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const handleNewMessage = (payload: {
      conversationId: string;
      message: ChatMessage;
    }) => {
      const append = (page: MessagePage | undefined) =>
        appendMessage(page, payload.message);
      qc.setQueryData(conversationKeys.messages(payload.conversationId), append);
      qc.setQueryData(
        conversationKeys.adminMessages(payload.conversationId),
        append,
      );
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
      qc.invalidateQueries({ queryKey: conversationKeys.admin() });
    };

    const handleConversationUpdated = () => {
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
      qc.invalidateQueries({ queryKey: conversationKeys.admin() });
    };

    // The server force-disconnects a user's sockets when their access
    // changes (role, suspension, password). Socket.io doesn't auto-reconnect
    // after that, so try once: the handshake re-checks the session and
    // simply refuses if they're no longer allowed in.
    const handleDisconnect = (reason: string) => {
      if (reason === "io server disconnect") socket.connect();
    };

    const handleNotification = () => qc.invalidateQueries({ queryKey: notificationKeys.all });

    socket.on("new_message", handleNewMessage);
    socket.on("notification", handleNotification);
    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("notification", handleNotification);
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("disconnect", handleDisconnect);
    };
  }, [isAuthenticated, qc]);
}

export { getSocket };
