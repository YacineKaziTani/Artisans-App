import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in .env");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY);

// Percentage of each booking/order kept by the platform, remainder goes to
// the artisan's connected Stripe account via transfer_data on the
// PaymentIntent (a "destination charge"). Configurable so this isn't
// hardcoded — defaults to 10% if unset.
export function platformFeeAmountCents(totalAmountCents: number) {
  const percent = Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 10);
  return Math.round((totalAmountCents * percent) / 100);
}
