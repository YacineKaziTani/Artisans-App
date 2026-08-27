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
      qc.invalidateQueries({
        queryKey: conversationKeys.messages(conversationId),
      });
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
    },
  });
}

export function useAdminConversations() {
  return useQuery({
    queryKey: conversationKeys.admin(),
    queryFn: () => conversationApi.listAllAdmin(),
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
