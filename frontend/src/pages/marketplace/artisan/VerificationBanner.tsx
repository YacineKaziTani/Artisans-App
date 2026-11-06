import { Button } from "@/components/ui/button";
import { useRequestVerification } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import type { Shop } from "@/types";

export function VerificationBanner({ shop }: { shop: Shop }) {
  const requestVerification = useRequestVerification();

  if (shop.verificationStatus === "verified") {
    return (
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-800 flex items-center gap-2">
        <span aria-hidden="true">✓</span>
        <span>Your shop is verified — the badge is visible to clients.</span>
      </div>
    );
  }

  if (shop.verificationStatus === "pending") {
    return (
      <div className="p-4 bg-muted border border-border rounded-lg text-sm text-foreground/80">
        Verification request submitted — an admin will review it soon.
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border border-border rounded-lg flex items-center justify-between flex-wrap gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">Get verified</p>
        <p className="text-sm text-muted-foreground">
          Verified shops get a badge that builds trust with clients.
          {shop.verificationStatus === "rejected" && shop.verificationNote && (
            <span className="block text-destructive mt-1">
              Previous request rejected: {shop.verificationNote}
            </span>
          )}
        </p>
        {requestVerification.isError && (
          <p className="text-xs text-destructive mt-1">
            {getErrorMessage(requestVerification.error)}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={requestVerification.isPending}
        onClick={() => requestVerification.mutate()}
      >
        {requestVerification.isPending ? "Requesting..." : "Request Verification"}
      </Button>
    </div>
  );
}
