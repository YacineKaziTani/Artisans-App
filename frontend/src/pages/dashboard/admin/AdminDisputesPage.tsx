import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminDisputes, useResolveDispute } from "@/hooks/useDisputes";
import type { DisputeStatus } from "@/types";

const STATUS_STYLES: Record<DisputeStatus, string> = {
  open: "bg-yellow-100 text-yellow-800 border-yellow-300",
  resolved_refunded: "bg-jade-50 text-jade-600 border-jade-500/25",
  resolved_denied: "bg-destructive/10 text-destructive border-destructive/25",
  resolved_other: "bg-muted text-foreground/80 border-border",
};

export default function AdminDisputesPage() {
  const [filter, setFilter] = useState<DisputeStatus | undefined>("open");
  const { data: disputes, isLoading, isError } = useAdminDisputes(filter);
  const resolveDispute = useResolveDispute();
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [refundAmountDraft, setRefundAmountDraft] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Disputes</h1>
        <p className="text-muted-foreground">
          Booking and order disputes raised by clients or artisans
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          ["open", "resolved_refunded", "resolved_denied", "resolved_other", undefined] as const
        ).map((s) => (
          <button
            key={s ?? "all"}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              filter === s
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground/80 border-border"
            }`}
          >
            {s ?? "All"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disputes</CardTitle>
          <CardDescription>{disputes?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
              Couldn't load disputes.
            </p>
          )}

          {!isLoading && !isError && (disputes ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">No disputes here.</p>
          )}

          {!isLoading &&
            !isError &&
            (disputes ?? []).map((dispute) => {
              const isUpdating =
                resolveDispute.isPending &&
                resolveDispute.variables?.id === dispute.id;

              return (
                <div key={dispute.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {dispute.targetType} #{dispute.targetId.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Raised by {dispute.raisedBy?.name} ·{" "}
                        {new Date(dispute.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[dispute.status]}`}
                    >
                      {dispute.status.replace("resolved_", "")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">"{dispute.reason}"</p>
                  {dispute.resolutionNote && (
                    <p className="text-xs text-muted-foreground">
                      Resolution: {dispute.resolutionNote}
                    </p>
                  )}

                  {dispute.status === "open" && (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={noteDraft[dispute.id] ?? ""}
                        onChange={(e) =>
                          setNoteDraft((prev) => ({
                            ...prev,
                            [dispute.id]: e.target.value,
                          }))
                        }
                        placeholder="Resolution note (optional)"
                        rows={2}
                        className="w-full text-sm border border-border rounded-md p-2"
                      />
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          Refund amount (leave blank for full refund)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Full amount"
                          value={refundAmountDraft[dispute.id] ?? ""}
                          onChange={(e) =>
                            setRefundAmountDraft((prev) => ({
                              ...prev,
                              [dispute.id]: e.target.value,
                            }))
                          }
                          className="w-40"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() =>
                            resolveDispute.mutate({
                              id: dispute.id,
                              status: "resolved_refunded",
                              resolutionNote: noteDraft[dispute.id],
                              refundAmount: refundAmountDraft[dispute.id]
                                ? Number(refundAmountDraft[dispute.id])
                                : undefined,
                            })
                          }
                        >
                          Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isUpdating}
                          onClick={() =>
                            resolveDispute.mutate({
                              id: dispute.id,
                              status: "resolved_denied",
                              resolutionNote: noteDraft[dispute.id],
                            })
                          }
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() =>
                            resolveDispute.mutate({
                              id: dispute.id,
                              status: "resolved_other",
                              resolutionNote: noteDraft[dispute.id],
                            })
                          }
                        >
                          Other Resolution
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
