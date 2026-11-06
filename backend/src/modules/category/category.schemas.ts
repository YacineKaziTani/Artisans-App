import { z } from "zod";
import { emptyToUndefined, optionalText, requiredText } from "../../lib/schemas";

const iconUrl = z.preprocess(
  emptyToUndefined,
  z.url("Icon must be a URL").max(500, "Icon URL is too long").optional(),
);

export const createCategorySchema = z.object({
  name: requiredText("Name", 60),
  description: optionalText("Description", 300),
  iconUrl,
});

export const updateCategorySchema = z.object({
  name: requiredText("Name", 60).optional(),
  description: optionalText("Description", 300),
  iconUrl,
  isActive: z.boolean({ error: "isActive must be true or false" }).optional(),
});
