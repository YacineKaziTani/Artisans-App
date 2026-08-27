import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in .env");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

export function platformFeeAmountCents(totalAmountCents: number) {
  const percent = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 10);
  return Math.round((totalAmountCents * percent) / 100);
}

export const bypassConnect =
  process.env.STRIPE_TEST_BYPASS_CONNECT === "true" &&
  process.env.NODE_ENV !== "production";

if (process.env.STRIPE_TEST_BYPASS_CONNECT === "true") {
  console.warn(
    bypassConnect
      ? "[stripe] STRIPE_TEST_BYPASS_CONNECT is ON — Connect onboarding checks and destination transfers are skipped."
      : "[stripe] STRIPE_TEST_BYPASS_CONNECT is ignored in production.",
  );
}

export function shopCanAcceptPayments(shop: {
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean;
}) {
  if (bypassConnect) return true;
  return Boolean(shop.stripeOnboardingComplete && shop.stripeAccountId);
}

export function connectChargeParams(
  shop: { stripeAccountId?: string | null },
  amountInCents: number,
) {
  if (bypassConnect || !shop.stripeAccountId) return {};
  return {
    application_fee_amount: platformFeeAmountCents(amountInCents),
    transfer_data: { destination: shop.stripeAccountId },
  };
}

export function connectRefundParams(refundApplicationFee = true) {
  if (bypassConnect) return {};
  return {
    reverse_transfer: true,
    refund_application_fee: refundApplicationFee,
  };
}
