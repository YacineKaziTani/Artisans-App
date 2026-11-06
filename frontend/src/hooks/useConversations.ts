import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { conversationApi, type MessagePage } from "@/api/conversation.api";
import { getSocket } from "@/lib/socket";
import type { ChatMessage } from "@/types";

export const conversationKeys = {
  all: ["conversations"] as const,
  mine: () => [...conversationKeys.all, "mine"] as const,
  messages: (id: string) => [...conversationKeys.all, id, "messages"] as const,
  admin: () => [...conversationKeys.all, "admin"] as const,
  adminMessages: (id: string) =>
    [...conversationKeys.all, "admin", id, "messages"] as const,
};

/** Adds a message to a cached thread, ignoring one that's already there. */
export function appendMessage(
  page: MessagePage | undefined,
  message: ChatMessage,
): MessagePage | undefined {
  if (!page || page.messages.some((m) => m.id === message.id)) return page;
  return { ...page, messages: [...page.messages, message] };
}

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

/** The newest page of a thread; older pages are added by useLoadEarlierMessages. */
export function useConversationMessages(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.messages(id ?? ""),
    queryFn: () => conversationApi.messages(id!),
    enabled: Boolean(id),
  });
}

/**
 * Fetches the page before the oldest loaded message and prepends it to the
 * cached thread (so live messages appended by the socket stay in place).
 */
export function useLoadEarlierMessages(id: string, { admin = false } = {}) {
  const qc = useQueryClient();
  const key = admin
    ? conversationKeys.adminMessages(id)
    : conversationKeys.messages(id);

  return useMutation({
    mutationFn: async () => {
      const current = qc.getQueryData<MessagePage>(key);
      const oldest = current?.messages[0]?.id;
      if (!oldest) return null;
      return admin
        ? conversationApi.messagesAdmin(id, oldest)
        : conversationApi.messages(id, oldest);
    },
    onSuccess: (older) => {
      if (!older) return;
      qc.setQueryData<MessagePage>(key, (current) => {
        if (!current) return current;
        const known = new Set(current.messages.map((m) => m.id));
        return {
          ...current,
          messages: [
            ...older.messages.filter((m) => !known.has(m.id)),
            ...current.messages,
          ],
          hasMore: older.hasMore,
        };
      });
    },
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string): Promise<ChatMessage | null> => {
      const socket = getSocket();
      if (!socket.connected) {
        return conversationApi.send(conversationId, content);
      }
      return new Promise<null>((resolve, reject) => {
        socket.emit(
          "send_message",
          { conversationId, content },
          (res: { ok: boolean; message?: string }) => {
            if (res.ok) resolve(null);
            else reject(new Error(res.message ?? "Failed to send message"));
          },
        );
      });
    },
    onSuccess: (sent) => {
      // Over the socket, the server's `new_message` event appends it. Over
      // the HTTP fallback there's no event, so append the response. Either
      // way, no refetch — that would drop older pages the user loaded.
      if (sent) {
        qc.setQueryData<MessagePage>(
          conversationKeys.messages(conversationId),
          (page) => appendMessage(page, sent),
        );
      }
      qc.invalidateQueries({ queryKey: conversationKeys.mine() });
    },
  });
}

export function useAdminConversations(page = 1) {
  return useQuery({
    queryKey: [...conversationKeys.admin(), "list", page],
    queryFn: () => conversationApi.listAllAdmin({ page }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminConversationMessages(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.adminMessages(id ?? ""),
    queryFn: () => conversationApi.messagesAdmin(id!),
    enabled: Boolean(id),
  });
}
