import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useConnectStripe, useStripeStatus } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import type { Shop } from "@/types";

export function StripeConnectBanner({ shop }: { shop: Shop }) {
  const connectStripe = useConnectStripe();
  const { data: status, isLoading, refetch, isFetching } = useStripeStatus();

  // Stripe sends the artisan back with ?stripe=return. Status is re-checked
  // on load (there's no background Connect webhook), so offer a recheck if
  // onboarding still isn't complete.
  const [searchParams] = useSearchParams();
  const justReturned = searchParams.get("stripe") === "return";

  const handleConnect = () => {
    connectStripe.mutate(undefined, {
      onSuccess: (result) => {
        window.location.href = result.url;
      },
    });
  };

  if (isLoading) {
    return <div className="p-4 h-16 rounded-lg bg-muted animate-pulse" />;
  }

  if (status?.onboardingComplete || shop.stripeOnboardingComplete) {
    return (
      <div className="p-4 bg-jade-50 border border-jade-500/25 rounded-lg text-sm text-jade-600 flex items-center gap-2">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        <span>Payouts are set up — bookings and orders will pay out to your account.</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-warning/10 border border-warning/25 rounded-lg space-y-2">
      <p className="text-sm font-semibold text-foreground/80">
        Set up payouts to start accepting bookings and orders
      </p>
      <p className="text-sm text-muted-foreground">
        Clients can't book services or buy products from your shop until you
        connect a payout account with Stripe — it only takes a few minutes.
        {justReturned && status && !status.onboardingComplete && (
          <span className="block mt-1">
            Looks like onboarding isn't finished yet.{" "}
            <button
              type="button"
              className="underline"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              {isFetching ? "Checking…" : "Check again"}
            </button>
            .
          </span>
        )}
      </p>
      <Button size="sm" disabled={connectStripe.isPending} onClick={handleConnect}>
        {connectStripe.isPending ? "Redirecting..." : "Connect with Stripe"}
      </Button>
      {connectStripe.isError && (
        <p className="text-xs text-destructive">
          {getErrorMessage(
            connectStripe.error,
            "Couldn't start Stripe onboarding. Please try again.",
          )}
        </p>
      )}
    </div>
  );
}
