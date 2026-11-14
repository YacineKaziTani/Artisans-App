import { z } from "zod";
import { clearableMoney, emptyToUndefined, money, uuid } from "../../lib/schemas";
import { DiscountKind } from "./discount-code.entities";

const dateTime = (label: string) =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    z.iso
      .datetime({ offset: true, error: `${label} must be a date and time` })
      .transform((value) => new Date(value))
      .nullable()
      .optional(),
  );

const maxUses = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce
    .number({ error: "Use limit must be a number" })
    .int("Use limit must be a whole number")
    .min(1, "Use limit must be at least 1")
    .max(1_000_000)
    .nullable()
    .optional(),
);

export const createDiscountSchema = z
  .object({
    code: z
      .string({ error: "Code is required" })
      .trim()
      .min(3, "Codes are at least 3 characters")
      .max(40, "Codes are at most 40 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - and _ only"),
    kind: z.enum(DiscountKind, { error: "Choose percent, amount or free delivery" }),
    value: z.preprocess(emptyToUndefined, z.coerce.number({ error: "Value must be a number" }).optional()),
    minSubtotal: clearableMoney("Minimum order", { min: 0.01 }),
    startsAt: dateTime("Start"),
    expiresAt: dateTime("End"),
    maxUses,
  })
  .superRefine((b, ctx) => {
    if (b.kind === DiscountKind.PERCENT && !(b.value !== undefined && b.value >= 1 && b.value <= 90 && Number.isInteger(b.value))) {
      ctx.addIssue({ code: "custom", message: "A percent discount is a whole number from 1 to 90", path: ["value"] });
    }
    if (b.kind === DiscountKind.AMOUNT && !(b.value !== undefined && b.value >= 0.5 && b.value <= 100_000)) {
      ctx.addIssue({ code: "custom", message: "An amount off must be at least $0.50", path: ["value"] });
    }
    if (b.startsAt && b.expiresAt && b.expiresAt <= b.startsAt) {
      ctx.addIssue({ code: "custom", message: "The end must be after the start", path: ["expiresAt"] });
    }
  })
  .transform((b) => ({ ...b, value: b.value !== undefined ? Math.round(b.value * 100) / 100 : undefined }));

export const updateDiscountSchema = z.object({
  active: z.boolean({ error: "active must be true or false" }).optional(),
  expiresAt: dateTime("End"),
  maxUses,
});

export const checkDiscountSchema = z.object({
  shopId: uuid("Shop"),
  code: z.string({ error: "Enter a code" }).trim().min(1, "Enter a code").max(40),
  subtotal: money("Subtotal"),
});
