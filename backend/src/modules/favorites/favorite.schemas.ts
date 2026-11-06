import { z } from "zod";
import { uuid } from "../../lib/schemas";
import { FavoriteTargetType } from "./favorite.entities";

export const toggleFavoriteSchema = z.object({
  targetType: z.enum(FavoriteTargetType, { error: "Invalid targetType" }),
  targetId: uuid("targetId"),
});
