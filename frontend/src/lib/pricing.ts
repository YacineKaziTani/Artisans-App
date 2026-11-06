import type { Product, ProductVariant } from "@/types";

// The one place the frontend works out a price — it used to be copied into
// the cart store, the Buy dialog and the variants manager. Same rules (and
// integer-cent arithmetic) as the API, so what's shown is what's charged.

const toCents = (amount: string | number | null | undefined) =>
  Math.round(Number(amount ?? 0) * 100);

/** Unit price of a product, or of one of its variants, in dollars. */
export function variantUnitPrice(
  product: Pick<Product, "basePrice">,
  variant?: ProductVariant | null,
): number {
  if (!variant) return toCents(product.basePrice) / 100;
  if (variant.priceOverride !== undefined && variant.priceOverride !== null) {
    return toCents(variant.priceOverride) / 100;
  }
  const modifiers = variant.values.reduce(
    (sum, value) => sum + toCents(value.priceModifier),
    0,
  );
  return (toCents(product.basePrice) + modifiers) / 100;
}

/** "Size: M, Color: Red". */
export function variantLabel(variant: ProductVariant): string {
  return variant.values
    .map((value) => `${value.option?.name ?? "Option"}: ${value.value}`)
    .join(", ");
}

/** Multiplies a unit price without float drift (10.1 × 3 is 30.30, not 30.299…). */
export function lineTotal(unitPrice: number, quantity: number): number {
  return (toCents(unitPrice) * quantity) / 100;
}

export function formatMoney(amount: string | number): string {
  return `$${Number(amount).toFixed(2)}`;
}

/**
 * The delivery charge for an order (a cart counts as one), mirroring the
 * API: the shop's flat fee, waived once the items reach its free-delivery
 * threshold. Pickup is always free.
 */
export function deliveryFeeFor(
  shop: { deliveryFee?: string | number; freeDeliveryOver?: string | number | null } | null | undefined,
  itemsSubtotal: number,
  method: "pickup" | "delivery",
) {
  if (method !== "delivery" || !shop) return 0;
  const threshold = shop.freeDeliveryOver;
  if (threshold != null && threshold !== "" && itemsSubtotal >= Number(threshold)) return 0;
  return Number(shop.deliveryFee ?? 0);
}

/** The method a shop allows first: pickup when offered, else delivery. */
export function defaultDeliveryMethod(shop: { pickupEnabled?: boolean } | null | undefined): "pickup" | "delivery" {
  return shop?.pickupEnabled === false ? "delivery" : "pickup";
}
