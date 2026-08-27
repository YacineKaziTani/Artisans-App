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

export const bypassConnect =
  import.meta.env.VITE_STRIPE_BYPASS_CONNECT === "true";

export function shopCanAcceptPayments(shop: {
  stripeOnboardingComplete?: boolean;
}) {
  return bypassConnect || Boolean(shop.stripeOnboardingComplete);
}
