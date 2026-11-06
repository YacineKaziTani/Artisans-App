import { EntityManager, IsNull, MoreThanOrEqual, Not } from "typeorm";
import { AppDataSource } from "../../data-source";
import { ProductVariant } from "./variant.entities";
import { Product } from "./product.entities";

/**
 * Atomically takes `quantity` units of a variant's stock, but only if that
 * many are left. A single `UPDATE … SET stock = stock - q WHERE stock >= q`
 * means two buyers racing for the last unit can't both succeed — the old
 * read-modify-write let concurrent checkouts oversell.
 *
 * Returns false (and changes nothing) when there isn't enough stock.
 */
export async function reserveVariantStock(
  manager: EntityManager,
  variantId: string,
  quantity: number,
): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity < 1) return false;
  const result = await manager.decrement(
    ProductVariant,
    { id: variantId, stockQuantity: MoreThanOrEqual(quantity) },
    "stockQuantity",
    quantity,
  );
  return (result.affected ?? 0) > 0;
}

/**
 * The same for a product sold without variants. Only called when the
 * product tracks stock (stockQuantity isn't NULL).
 */
export async function reserveProductStock(
  manager: EntityManager,
  productId: string,
  quantity: number,
): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity < 1) return false;
  const result = await manager.decrement(
    Product,
    { id: productId, stockQuantity: MoreThanOrEqual(quantity) },
    "stockQuantity",
    quantity,
  );
  return (result.affected ?? 0) > 0;
}

/** Atomically puts variant stock back (cancelled, refunded or abandoned lines). */
export async function restoreVariantStock(
  variantId: string | undefined | null,
  quantity = 1,
  manager: EntityManager = AppDataSource.manager,
) {
  if (!variantId || !Number.isInteger(quantity) || quantity < 1) return;
  await manager.increment(
    ProductVariant,
    { id: variantId },
    "stockQuantity",
    quantity,
  );
}

/**
 * Puts back whatever stock an order line reserved: its variant's, or — for
 * a product sold without variants — the product's, if it tracks stock.
 *
 * `variantLabel` is the test for "was bought as a variant", not `variant`:
 * the variant relation is set to NULL if the variant is later deleted, and
 * that line must not then be credited to the product's own stock.
 */
export async function restoreOrderStock(
  order: {
    quantity: number;
    productId?: string | null;
    variant?: { id: string } | null;
    variantLabel?: string | null;
  },
  manager: EntityManager = AppDataSource.manager,
) {
  if (order.variantLabel || order.variant) {
    await restoreVariantStock(order.variant?.id, order.quantity, manager);
    return;
  }
  if (!order.productId || !Number.isInteger(order.quantity) || order.quantity < 1) {
    return;
  }
  await manager.increment(
    Product,
    { id: order.productId, stockQuantity: Not(IsNull()) },
    "stockQuantity",
    order.quantity,
  );
}
