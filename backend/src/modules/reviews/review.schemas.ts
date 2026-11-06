import { z } from "zod";
import { int, optionalInt, optionalText } from "../../lib/schemas";

export const createReviewSchema = z.object({
  rating: int("Rating", 1, 5),
  comment: optionalText("Comment", 2000),
});

export const updateReviewSchema = z
  .object({
    rating: optionalInt("Rating", 1, 5),
    comment: optionalText("Comment", 2000),
  })
  .refine((b) => b.rating !== undefined || b.comment !== undefined, {
    message: "Nothing to update",
  });
