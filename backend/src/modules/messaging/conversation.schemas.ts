import { z } from "zod";
import { requiredText, uuid } from "../../lib/schemas";
import { MAX_MESSAGE_LENGTH } from "./message.limits";

export const startConversationSchema = z.object({
  shopId: uuid("Shop"),
});

export const sendMessageSchema = z.object({
  content: requiredText("Message", MAX_MESSAGE_LENGTH),
});
