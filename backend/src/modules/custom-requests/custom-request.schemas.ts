import { z } from "zod";
import { clearableMoney, money, optionalText, requiredText, uuid } from "../../lib/schemas";
import { DeliveryMethod } from "../orders/order.entities";

/** "YYYY-MM-DD", today or later (a day's leeway for time zones). */
const futureDate = (label: string) =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    z
      .string({ error: `${label} must be a date` })
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date`)
      .refine((v) => !Number.isNaN(Date.parse(v)), `${label} must be a date`)
      .refine((v) => Date.parse(v) >= Date.now() - 36 * 60 * 60 * 1000, `${label} can't be in the past`)
      .refine((v) => Date.parse(v) <= Date.now() + 2 * 365 * 24 * 60 * 60 * 1000, `${label} is too far ahead`)
      .nullable()
      .optional(),
  );

export const createCustomRequestSchema = z.object({
  shopId: uuid("Shop"),
  description: requiredText("Description", 3000).refine(
    (v) => v.length >= 20,
    "Tell the artisan a bit more — at least a sentence or two",
  ),
  budget: clearableMoney("Budget", { min: 1 }),
  neededBy: futureDate("Needed-by date"),
});

export const quoteCustomRequestSchema = z.object({
  price: money("Price", { min: 0.5 }),
  readyBy: futureDate("Ready-by date"),
  note: optionalText("Note", 1000),
});

export const declineCustomRequestSchema = z.object({
  note: optionalText("Note", 1000),
});

export const acceptCustomRequestSchema = z
  .object({
    deliveryMethod: z.enum(DeliveryMethod, { error: "Choose pickup or delivery" }).default(DeliveryMethod.PICKUP),
    shippingAddress: optionalText("Shipping address", 500),
  })
  .superRefine((b, ctx) => {
    if (b.deliveryMethod === DeliveryMethod.DELIVERY && !b.shippingAddress) {
      ctx.addIssue({ code: "custom", message: "A shipping address is required for delivery", path: ["shippingAddress"] });
    }
  });
