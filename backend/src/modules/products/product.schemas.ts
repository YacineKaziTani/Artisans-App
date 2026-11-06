import { z } from "zod";
import {
  clearableInt,
  clearableMoney,
  money,
  optionalInt,
  optionalMoney,
  optionalText,
  requiredText,
  uuid,
} from "../../lib/schemas";

const MAX_STOCK = 1_000_000;

// Product create accepts multipart (an optional image), so numbers may
// arrive as strings — the money/int helpers coerce them.

// stockQuantity: a count for products sold without variants; empty/null
// means "not tracked" (made to order).
export const createProductSchema = z.object({
  title: requiredText("Title", 150),
  description: optionalText("Description", 5000),
  basePrice: money("Price"),
  stockQuantity: clearableInt("Stock", 0, MAX_STOCK),
});

export const updateProductSchema = z.object({
  title: requiredText("Title", 150).optional(),
  description: optionalText("Description", 5000),
  basePrice: optionalMoney("Price"),
  stockQuantity: clearableInt("Stock", 0, MAX_STOCK),
});

export const createVariantOptionSchema = z.object({
  name: requiredText("Option name", 50),
});

export const createVariantValueSchema = z.object({
  value: requiredText("Value", 50),
  priceModifier: optionalMoney("Price adjustment", {
    min: -99_999,
    max: 99_999,
  }),
});

export const createProductVariantSchema = z.object({
  valueIds: z
    .array(uuid("Value"), { error: "valueIds must be a list of value ids" })
    .min(1, "Pick a value for every option")
    .max(10, "A variant can combine at most 10 options"),
  sku: optionalText("SKU", 64),
  stockQuantity: optionalInt("Stock", 0, MAX_STOCK),
  priceOverride: clearableMoney("Fixed price", { min: 0.5 }),
});

export const updateProductVariantSchema = z.object({
  sku: optionalText("SKU", 64),
  stockQuantity: optionalInt("Stock", 0, MAX_STOCK),
  priceOverride: clearableMoney("Fixed price", { min: 0.5 }),
});
