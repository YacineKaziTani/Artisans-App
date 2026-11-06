import { api } from "@/lib/axios";
import type { ChatMessage, Conversation, Page, PageParams } from "@/types";

/** One page of a thread, oldest → newest, plus whether older ones exist. */
export interface MessagePage {
  conversation: Conversation;
  messages: ChatMessage[];
  hasMore: boolean;
}

export const conversationApi = {
  start: (shopId: string) =>
    api.post<Conversation>("/conversations", { shopId }).then((r) => r.data),

  mine: () =>
    api.get<Conversation[]>("/conversations/mine").then((r) => r.data),

  /** `before` = id of the oldest message already loaded. */
  messages: (id: string, before?: string) =>
    api
      .get<MessagePage>(`/conversations/${id}/messages`, {
        params: before ? { before } : {},
      })
      .then((r) => r.data),

  send: (id: string, content: string) =>
    api
      .post<ChatMessage>(`/conversations/${id}/messages`, { content })
      .then((r) => r.data),

  listAllAdmin: (params: PageParams = {}) =>
    api
      .get<Page<Conversation>>("/conversations/admin/all", { params })
      .then((r) => r.data),

  messagesAdmin: (id: string, before?: string) =>
    api
      .get<MessagePage>(`/conversations/admin/${id}/messages`, {
        params: before ? { before } : {},
      })
      .then((r) => r.data),
};
