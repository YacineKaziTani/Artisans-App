// Stripe Connect rules that don't need the Stripe SDK, so entities can use
// them (e.g. Shop.toJSON computing `acceptsPayments`) without loading it.

export const bypassConnect =
  process.env.STRIPE_TEST_BYPASS_CONNECT === "true" &&
  process.env.NODE_ENV !== "production";

/** Whether a shop can be paid: it has a fully onboarded Connect account. */
export function shopCanAcceptPayments(shop: {
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean;
}) {
  if (bypassConnect) return true;
  return Boolean(shop.stripeOnboardingComplete && shop.stripeAccountId);
}
