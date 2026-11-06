import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useMyDisputes } from "@/hooks/useDisputes";
import type { DisputeStatus } from "@/types";

const LABELS: Record<DisputeStatus, string> = {
  open: "Being reviewed",
  resolved_refunded: "Refunded",
  resolved_denied: "No refund",
  resolved_other: "Resolved",
};

/**
 * Disputes you opened and where they stand — before, the outcome only
 * arrived by email. Hidden when you've never opened one.
 */
export function MyDisputesCard() {
  const { data: disputes, isLoading, isError } = useMyDisputes();
  if (isLoading || isError || !disputes?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your disputes</CardTitle>
        <CardDescription>Our team reviews each one and emails both sides with the outcome.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {disputes.map((d) => (
          <div key={d.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize">
                {d.targetType} · opened {new Date(d.createdAt).toLocaleDateString()}
              </p>
              <StatusBadge status={d.status} label={LABELS[d.status]} />
            </div>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">{d.reason}</p>
            {d.resolutionNote && (
              <p className="mt-2 rounded-md bg-muted/60 px-3 py-2">
                <span className="font-medium">From our team:</span> {d.resolutionNote}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
