import { loadStripe } from "@stripe/stripe-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;

if (!publishableKey) {
  console.warn(
    "VITE_STRIPE_PUBLISHABLE_KEY is not set — booking payments will not work.",
  );
}

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/**
 * Whether a shop can take bookings/orders right now. The API works this out
 * (Connect onboarding, plus its own STRIPE_TEST_BYPASS_CONNECT setting) and
 * sends `acceptsPayments` with every shop — there's no separate frontend
 * flag to keep in sync any more.
 */
export function shopCanAcceptPayments(shop: { acceptsPayments?: boolean }) {
  return Boolean(shop.acceptsPayments);
}
