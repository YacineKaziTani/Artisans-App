import Stripe from "stripe";
import { bypassConnect, shopCanAcceptPayments } from "./connect";

export { bypassConnect, shopCanAcceptPayments };

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in .env");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

export function platformFeeAmountCents(totalAmountCents: number) {
  const percent = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 10);
  return Math.round((totalAmountCents * percent) / 100);
}

if (process.env.STRIPE_TEST_BYPASS_CONNECT === "true") {
  console.warn(
    bypassConnect
      ? "[stripe] STRIPE_TEST_BYPASS_CONNECT is ON — Connect onboarding checks and destination transfers are skipped."
      : "[stripe] STRIPE_TEST_BYPASS_CONNECT is ignored in production.",
  );
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

// ── Unpaid checkouts (see config/checkout.ts for the expiry window) ───────

export type AbandonOutcome =
  | "abandoned" // nothing was paid — safe to discard the order/booking
  | "authorized" // the card is actually on hold; the webhook just hasn't landed
  | "captured" // already charged
  | "in_flight"; // Stripe is still processing — leave it for the next sweep

/**
 * Before discarding an unpaid checkout, ask Stripe what really happened —
 * our row says "unpaid" but the authorization webhook may simply be late.
 * When it genuinely is unpaid, the PaymentIntent is cancelled so it can't
 * be confirmed after the order is gone.
 */
export async function closeUnpaidIntent(
  intentId: string | null | undefined,
): Promise<AbandonOutcome> {
  if (!intentId) return "abandoned";

  const intent = await stripe.paymentIntents.retrieve(intentId);
  switch (intent.status) {
    case "requires_capture":
      return "authorized";
    case "succeeded":
      return "captured";
    case "processing":
      return "in_flight";
    case "canceled":
      return "abandoned";
    default:
      // requires_payment_method / requires_confirmation / requires_action
      await stripe.paymentIntents.cancel(intentId);
      return "abandoned";
  }
}

/** Best-effort cancel of an intent nobody will pay any more. */
export async function cancelIntentQuietly(intentId: string | null | undefined) {
  if (!intentId) return;
  try {
    await stripe.paymentIntents.cancel(intentId);
  } catch (err) {
    // Already cancelled/captured, or Stripe is unreachable — either way the
    // order is closed on our side, and an unconfirmed intent can't charge.
    console.warn("[stripe] couldn't cancel intent", intentId, err);
  }
}
