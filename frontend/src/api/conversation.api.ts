import { api } from "@/lib/axios";
import type { ChatMessage, Conversation } from "@/types";

export const conversationApi = {
  start: (shopId: string) =>
    api.post<Conversation>("/conversations", { shopId }).then((r) => r.data),

  mine: () =>
    api.get<Conversation[]>("/conversations/mine").then((r) => r.data),

  messages: (id: string) =>
    api
      .get<{ conversation: Conversation; messages: ChatMessage[] }>(
        `/conversations/${id}/messages`,
      )
      .then((r) => r.data),

  send: (id: string, content: string) =>
    api
      .post<ChatMessage>(`/conversations/${id}/messages`, { content })
      .then((r) => r.data),

  listAllAdmin: () =>
    api.get<Conversation[]>("/conversations/admin/all").then((r) => r.data),

  messagesAdmin: (id: string) =>
    api
      .get<{ conversation: Conversation; messages: ChatMessage[] }>(
        `/conversations/admin/${id}/messages`,
      )
      .then((r) => r.data),
};
