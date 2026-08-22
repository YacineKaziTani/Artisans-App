import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationApi } from "@/api/conversation.api";
import { getSocket } from "@/lib/socket";

export const conversationKeys = {
  all: ["conversations"] as const,
  mine: () => [...conversationKeys.all, "mine"] as const,
  messages: (id: string) => [...conversationKeys.all, id, "messages"] as const,
  admin: () => [...conversationKeys.all, "admin"] as const,
  adminMessages: (id: string) =>
    [...conversationKeys.all, "admin", id, "messages"] as const,
};

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: string) => conversationApi.start(shopId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
    },
  });
}

export function useMyConversations(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: conversationKeys.mine(),
    queryFn: conversationApi.mine,
    // Live updates arrive via socket ("conversation_updated"); this is just
    // a safety net in case a socket drops without reconnecting.
    refetchInterval: 30000,
    enabled: options.enabled ?? true,
  });
}

export function useConversationMessages(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.messages(id ?? ""),
    queryFn: () => conversationApi.messages(id!),
    enabled: Boolean(id),
  });
}

// Sends over the socket for real-time delivery, with a REST fallback if the
// socket isn't connected (e.g. reconnecting after a network blip).
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => {
      const socket = getSocket();
      if (!socket.connected) {
        return conversationApi.send(conversationId, content);
      }
      return new Promise<{ id: string }>((resolve, reject) => {
        socket.emit(
          "send_message",
          { conversationId, content },
          (res: { ok: boolean; message?: string }) => {
            if (res.ok) resolve({ id: "" });
            else reject(new Error(res.message ?? "Failed to send message"));
          },
        );
      });
    },
    onSuccess: () => {
      // The socket path already pushes the new message into the cache via
      // useSocketConnection; this covers the REST fallback path.
      qc.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
    },
  });
}

export function useAdminConversations() {
  return useQuery({
    queryKey: conversationKeys.admin(),
    queryFn: conversationApi.listAllAdmin,
    refetchInterval: 30000,
  });
}

export function useAdminConversationMessages(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.adminMessages(id ?? ""),
    queryFn: () => conversationApi.messagesAdmin(id!),
    enabled: Boolean(id),
  });
}
