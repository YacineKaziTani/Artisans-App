import { isAxiosError } from "axios";

const DEFAULT_MESSAGE = "Something went wrong. Please try again.";

/**
 * The message to show a user for a failed request. Prefers what the API
 * said ("Only 2 left of that variant", "That time overlaps another
 * booking…") over a generic line — the API's messages are written for end
 * users, and hiding them left people guessing why something failed.
 */
export function getErrorMessage(error: unknown, fallback = DEFAULT_MESSAGE): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Can't reach the server — check your connection and try again.";
    }
    const data = error.response.data as
      | { message?: unknown; error?: unknown }
      | undefined;
    const message = data?.message ?? data?.error;
    if (typeof message === "string" && message.trim()) return message;
    return fallback;
  }
  // Socket.io acks reject with a plain Error carrying the server's message.
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
