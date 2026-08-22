import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth.store";
import { conversationKeys } from "@/hooks/useConversations";
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
      const appendIfPresent = (
        old: { conversation: unknown; messages: ChatMessage[] } | undefined,
      ) => {
        if (!old) return old;
        if (old.messages.some((m) => m.id === payload.message.id)) {
          return old;
        }
        return { ...old, messages: [...old.messages, payload.message] };
      };

      qc.setQueryData(
        conversationKeys.messages(payload.conversationId),
        appendIfPresent,
      );
      qc.setQueryData(
        conversationKeys.adminMessages(payload.conversationId),
        appendIfPresent,
      );
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
      qc.invalidateQueries({ queryKey: conversationKeys.admin() });
    };

    const handleConversationUpdated = () => {
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
      qc.invalidateQueries({ queryKey: conversationKeys.admin() });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("conversation_updated", handleConversationUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("conversation_updated", handleConversationUpdated);
    };
  }, [isAuthenticated, qc]);
}

export { getSocket };
