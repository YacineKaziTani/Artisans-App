import { z } from "zod";
import {
  clearableMoney,
  emptyToUndefined,
  money,
  optionalText,
  phone,
  requiredText,
  uuid,
} from "../../lib/schemas";
import { isValidTimeZone, toMinutes, WEEKDAYS } from "../../lib/schedule";
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

// ── Opening hours (JSON, not multipart) ───────────────────────────────────

const clock = z
  .string({ error: "Times must look like 09:30" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Times must look like 09:30");

const dayRanges = z
  .array(z.object({ open: clock, close: clock }))
  .max(3, "At most 3 opening periods per day")
  .superRefine((ranges, ctx) => {
    const sorted = [...ranges].sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
    sorted.forEach((r, i) => {
      if (toMinutes(r.open) >= toMinutes(r.close)) {
        ctx.addIssue({ code: "custom", message: `${r.open}–${r.close}: closing time must be after opening time` });
      }
      const prev = sorted[i - 1];
      if (prev && toMinutes(r.open) < toMinutes(prev.close)) {
        ctx.addIssue({ code: "custom", message: "Opening periods on the same day can't overlap" });
      }
    });
  });

export const shopHoursSchema = z.object({
  timezone: z
    .string({ error: "Choose a time zone" })
    .refine(isValidTimeZone, "Choose a valid time zone"),
  // null = no fixed hours (clients request any time).
  openingHours: z
    .object(Object.fromEntries(WEEKDAYS.map((d) => [d, dayRanges.optional()])))
    .strict()
    .nullable(),
});

// ── Delivery options (JSON) ────────────────────────────────────────────────

export const shopDeliverySchema = z
  .object({
    pickupEnabled: z.boolean({ error: "pickupEnabled must be true or false" }),
    deliveryEnabled: z.boolean({ error: "deliveryEnabled must be true or false" }),
    deliveryFee: money("Delivery fee", { max: 1000 }),
    freeDeliveryOver: clearableMoney("Free delivery threshold", { min: 0.01 }),
    deliveryArea: optionalText("Delivery area", 300),
  })
  .refine((b) => b.pickupEnabled || b.deliveryEnabled, {
    message: "Offer at least one of pickup or delivery",
    path: ["pickupEnabled"],
  });
