import { z } from "zod";
import { emptyToUndefined, int, optionalInt, optionalText, uuid } from "../../lib/schemas";

export const createReviewSchema = z.object({
  rating: int("Rating", 1, 5),
  comment: optionalText("Comment", 2000),
  // A product the client received from this shop (optional).
  productId: z.preprocess(emptyToUndefined, uuid("productId").optional()),
});

export const reviewReplySchema = z.object({
  reply: optionalText("Reply", 2000),
});

export const updateReviewSchema = z
  .object({
    rating: optionalInt("Rating", 1, 5),
    comment: optionalText("Comment", 2000),
    // null clears the product tag.
    productId: uuid("productId").nullable().optional(),
  })
  .refine((b) => b.rating !== undefined || b.comment !== undefined || b.productId !== undefined, {
    message: "Nothing to update",
  });
