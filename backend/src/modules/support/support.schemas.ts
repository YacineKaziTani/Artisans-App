import { z } from "zod";
import { email, optionalText, requiredText } from "../../lib/schemas";

export const CONTACT_TOPICS = ["order", "booking", "selling", "account", "other"] as const;

export const contactSchema = z.object({
  name: requiredText("Name", 100),
  email: email(),
  topic: z.enum(CONTACT_TOPICS, { error: "Choose a topic" }),
  message: requiredText("Message", 5000).min(10, "Please tell us a bit more (at least 10 characters)"),
  // Hidden field real visitors never fill — bots usually do.
  website: optionalText("website", 200),
});
