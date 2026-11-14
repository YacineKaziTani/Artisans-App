import { EntityManager } from "typeorm";
import { AppDataSource } from "../../data-source";
import { DiscountCode, DiscountKind } from "./discount-code.entities";
import { fromCents, toCents } from "../../lib/money";
import { withinCheckoutTtlSql } from "../../config/checkout";

export class DiscountError extends Error {}

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export interface AppliedDiscount {
  code: DiscountCode;
  /** Taken off the items (never the delivery fee). */
  itemsDiscountCents: number;
  freeDelivery: boolean;
}

/**
 * How many checkouts have used a code. Counted from the orders that carry
 * it (one per checkout, however many lines), so an unpaid checkout that's
 * abandoned or expires gives its use back without any bookkeeping.
 */
export async function discountUses(manager: EntityManager, codeId: string) {
  const [{ count }] = await manager.query(
    `SELECT COUNT(DISTINCT COALESCE("checkoutGroupId", id::text))::int AS count
       FROM orders
      WHERE "discountCodeId" = $1
        AND ("paymentStatus" NOT IN ('unpaid', 'failed') OR ${withinCheckoutTtlSql('"createdAt"')})`,
    [codeId],
  );
  return Number(count);
}

/**
 * Checks a code for a shop's checkout and works out the discount.
 * Inside a checkout transaction (`lock`), concurrent checkouts using the
 * same code are serialised, so a code's use limit can't be overshot.
 */
export async function resolveDiscount(
  manager: EntityManager,
  shopId: string,
  rawCode: string,
  itemsCents: number,
  { lock = false } = {},
): Promise<AppliedDiscount> {
  const code = await manager
    .getRepository(DiscountCode)
    .createQueryBuilder("d")
    .where('d."shopId" = :shopId', { shopId })
    .andWhere("d.code = :code", { code: normalizeCode(rawCode) })
    .getOne();
  if (!code || !code.active) throw new DiscountError("That code isn't valid for this shop");

  const now = Date.now();
  if (code.startsAt && code.startsAt.getTime() > now) throw new DiscountError("That code isn't active yet");
  if (code.expiresAt && code.expiresAt.getTime() <= now) throw new DiscountError("That code has expired");
  if (code.minSubtotal != null && itemsCents < toCents(code.minSubtotal)) {
    throw new DiscountError(`That code needs at least $${fromCents(toCents(code.minSubtotal)).toFixed(2)} of items`);
  }
  if (code.maxUses != null) {
    if (lock) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`discount:${code.id}`]);
    }
    if ((await discountUses(manager, code.id)) >= code.maxUses) {
      throw new DiscountError("That code has been fully used");
    }
  }

  let itemsDiscountCents = 0;
  if (code.kind === DiscountKind.PERCENT) {
    itemsDiscountCents = Math.floor((itemsCents * Number(code.value)) / 100);
  } else if (code.kind === DiscountKind.AMOUNT) {
    itemsDiscountCents = Math.min(itemsCents, toCents(code.value));
  }
  return { code, itemsDiscountCents, freeDelivery: code.kind === DiscountKind.FREE_DELIVERY };
}

/**
 * Splits a discount across order lines in proportion to their amounts
 * (largest remainder, so the parts add up exactly). Each line's own share
 * comes off its total, so per-line capture and refunds stay correct.
 */
export function allocate(totalCents: number, lineCents: number[]): number[] {
  const sum = lineCents.reduce((a, b) => a + b, 0);
  if (sum <= 0 || totalCents <= 0) return lineCents.map(() => 0);
  const exact = lineCents.map((c) => (totalCents * c) / sum);
  const shares = exact.map(Math.floor);
  let left = totalCents - shares.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i]++;
    left--;
  }
  return shares;
}

/** For the public "check this code" call (no lock: nothing is reserved). */
export function previewDiscount(shopId: string, code: string, itemsCents: number) {
  return resolveDiscount(AppDataSource.manager, shopId, code, itemsCents);
}
