import { z } from "zod";
import {
  emptyToUndefined,
  optionalText,
  phone,
  requiredText,
  uuid,
} from "../../lib/schemas";
import { ShopStatus, VerificationStatus } from "./shop.entities";

// These routes accept multipart (an optional logo), so every value arrives
// as a string; an empty string means "not provided" on create and "clear
// it" on update.

export const createShopSchema = z.object({
  shopName: requiredText("Shop name", 120),
  categoryId: uuid("Category"),
  description: optionalText("Description", 2000),
  address: optionalText("Address", 200),
  city: optionalText("City", 100),
  phone: z.preprocess(emptyToUndefined, phone().optional()),
});

export const updateShopSchema = z.object({
  shopName: requiredText("Shop name", 120).optional(),
  categoryId: z.preprocess(emptyToUndefined, uuid("Category").optional()),
  description: optionalText("Description", 2000),
  address: optionalText("Address", 200),
  city: optionalText("City", 100),
  phone: z.union([z.literal(""), phone()]).optional(),
});

export const shopStatusSchema = z.object({
  status: z.enum(ShopStatus, { error: "Invalid status" }),
});

export const resolveVerificationSchema = z.object({
  status: z.enum([VerificationStatus.VERIFIED, VerificationStatus.REJECTED], {
    error: "Invalid verification status",
  }),
  note: optionalText("Note", 500),
});
