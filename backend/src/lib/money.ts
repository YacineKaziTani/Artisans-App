// Money is stored as decimal(10, 2) dollars (exact in Postgres), but all
// arithmetic happens in integer cents: floats can't represent most cent
// values, so summing or multiplying dollar amounts drifts (10.1 * 3 is
// 30.299999999999997). Convert at the edges, compute in cents.

/** Dollars (number, or the string Postgres returns for decimals) → cents. */
export function toCents(amount: number | string | null | undefined): number {
  return Math.round(Number(amount ?? 0) * 100);
}

/** Cents → dollars, for storing in a decimal column or returning to clients. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Stripe's minimum card charge for USD. */
export const MIN_CHARGE_CENTS = 50;
