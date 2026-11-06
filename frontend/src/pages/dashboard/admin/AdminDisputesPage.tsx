import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminDisputes, useResolveDispute } from "@/hooks/useDisputes";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/pricing";
import { StatusBadge } from "@/components/StatusBadge";
import type { Dispute, DisputeStatus, DisputeTarget } from "@/types";

const STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "Open",
  resolved_refunded: "Refunded",
  resolved_denied: "Denied",
  resolved_other: "Resolved",
};

const FILTERS: (DisputeStatus | undefined)[] = [
  "open",
  "resolved_refunded",
  "resolved_denied",
  "resolved_other",
  undefined,
];

// Matches the API: only a held (authorized) or captured (paid) payment can
// be refunded from a dispute. A partial refund already settled it.
const REFUNDABLE = new Set(["authorized", "paid"]);

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

/** What the dispute is about — the admin needs this to decide. */
function TargetSummary({ dispute, target }: { dispute: Dispute; target: DisputeTarget | null | undefined }) {
  if (!target) {
    return (
      <p className="text-sm text-muted-foreground">
        The {dispute.targetType} this dispute is about no longer exists
        (#{dispute.targetId.slice(0, 8)}).
      </p>
    );
  }
  return (
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      <div>
        <dt className="inline text-muted-foreground">Shop: </dt>
        <dd className="inline">
          {target.shop.shopName}
          {target.shop.owner ? ` (${target.shop.owner.name}, ${target.shop.owner.email})` : ""}
        </dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Client: </dt>
        <dd className="inline">
          {target.client ? `${target.client.name} (${target.client.email})` : "Deleted account"}
        </dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Amount: </dt>
        <dd className="inline font-medium">{formatMoney(target.totalAmount)}</dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Payment: </dt>
        <dd className="inline capitalize">{humanize(target.paymentStatus)}</dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Status: </dt>
        <dd className="inline capitalize">{humanize(target.status)}</dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">
          {target.scheduledAt ? "Scheduled: " : "Placed: "}
        </dt>
        <dd className="inline">
          {new Date(target.scheduledAt ?? target.createdAt).toLocaleString()}
        </dd>
      </div>
      {target.deliveryMethod && (
        <div>
          <dt className="inline text-muted-foreground">Delivery: </dt>
          <dd className="inline capitalize">{target.deliveryMethod}</dd>
        </div>
      )}
      {target.partOfCart && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Paid together with other items in one cart checkout — a refund here
          only covers this line.
        </p>
      )}
    </dl>
  );
}

export default function AdminDisputesPage() {
  const [filter, setFilter] = useState<DisputeStatus | undefined>("open");
  const [page, setPage] = useState(1);
  const { data: disputesPage, isLoading, isError, isFetching } = useAdminDisputes(filter, page);
  const disputes = disputesPage?.data;
  const resolveDispute = useResolveDispute();
  const confirm = useConfirm();
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [refundAmountDraft, setRefundAmountDraft] = useState<Record<string, string>>({});

  const resolve = async (dispute: Dispute, status: DisputeStatus) => {
    const target = dispute.target;
    const note = noteDraft[dispute.id]?.trim() || undefined;
    const draft = refundAmountDraft[dispute.id]?.trim() ?? "";
    const refundAmount = status === "resolved_refunded" && draft !== "" ? Number(draft) : undefined;

    let title: string;
    let description: React.ReactNode;
    let confirmLabel: string;
    let destructive = false;

    if (status === "resolved_refunded") {
      const total = Number(target?.totalAmount ?? 0);
      if (target?.paymentStatus === "authorized") {
        title = `Release the ${formatMoney(total)} card hold?`;
        description =
          "The client was never charged — this cancels the hold in full (a partial amount doesn't apply) and the dispute is closed as refunded.";
      } else {
        const amount = refundAmount ?? total;
        title = `Refund ${formatMoney(amount)} to ${target?.client?.name ?? "the client"}?`;
        description =
          refundAmount !== undefined && refundAmount < total
            ? `A partial refund of ${formatMoney(amount)} out of ${formatMoney(total)}, sent through Stripe. This can't be undone.`
            : `The full ${formatMoney(total)} goes back to the client's card through Stripe. This can't be undone.`;
      }
      confirmLabel = "Refund";
      destructive = true;
    } else if (status === "resolved_denied") {
      title = "Deny this dispute?";
      description = "No money moves. The dispute is closed and can't be reopened.";
      confirmLabel = "Deny";
      destructive = true;
    } else {
      title = "Close this dispute without a refund?";
      description =
        "Use this when it was settled another way — add a note saying how. No money moves.";
      confirmLabel = "Close dispute";
    }

    const ok = await confirm({ title, description, confirmLabel, destructive });
    if (!ok) return;
    resolveDispute.mutate({ id: dispute.id, status, resolutionNote: note, refundAmount });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Disputes</h1>
        <p className="text-muted-foreground">
          Booking and order disputes raised by clients or artisans
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            aria-pressed={filter === s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              filter === s
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground/80 border-border"
            }`}
          >
            {s ? STATUS_LABELS[s] : "All"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disputes</CardTitle>
          <CardDescription>{disputesPage?.meta.total ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && <p className="alert-error">Couldn't load disputes.</p>}

          {!isLoading && !isError && (disputes ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">No disputes here.</p>
          )}

          {!isLoading &&
            !isError &&
            (disputes ?? []).map((dispute) => {
              const target = dispute.target;
              const isThis = resolveDispute.variables?.id === dispute.id;
              const isUpdating = resolveDispute.isPending && isThis;
              const failed = resolveDispute.isError && isThis;
              const canRefund = Boolean(target && REFUNDABLE.has(target.paymentStatus));
              const total = Number(target?.totalAmount ?? 0);
              const draft = refundAmountDraft[dispute.id] ?? "";
              const draftAmount = Number(draft);
              const badRefund =
                draft !== "" && (!(draftAmount > 0) || draftAmount > total);

              return (
                <div key={dispute.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        <span className="capitalize">{dispute.targetType}</span>:{" "}
                        {target?.title ?? `#${dispute.targetId.slice(0, 8)}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Raised by {dispute.raisedBy?.name ?? "a deleted account"} ·{" "}
                        {new Date(dispute.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={dispute.status} label={STATUS_LABELS[dispute.status]} />
                  </div>

                  <TargetSummary dispute={dispute} target={target} />

                  <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground whitespace-pre-line">
                    {dispute.reason}
                  </blockquote>
                  {dispute.resolutionNote && (
                    <p className="text-xs text-muted-foreground">
                      Resolution: {dispute.resolutionNote}
                    </p>
                  )}

                  {dispute.status === "open" && (
                    <div className="space-y-2 pt-1">
                      {failed && (
                        <p className="alert-error">
                          {getErrorMessage(resolveDispute.error, "Couldn't resolve this dispute.")}
                        </p>
                      )}
                      <Textarea
                        value={noteDraft[dispute.id] ?? ""}
                        onChange={(e) =>
                          setNoteDraft((prev) => ({ ...prev, [dispute.id]: e.target.value }))
                        }
                        placeholder="Resolution note (optional — shared with both sides)"
                        aria-label="Resolution note"
                        maxLength={2000}
                        rows={2}
                        className="text-sm"
                      />
                      {canRefund && target?.paymentStatus !== "authorized" && (
                        <div>
                          <label
                            htmlFor={`refund-${dispute.id}`}
                            className="text-xs text-muted-foreground block mb-1"
                          >
                            Refund amount (leave blank to refund the full {formatMoney(total)})
                          </label>
                          <Input
                            id={`refund-${dispute.id}`}
                            type="number"
                            min="0.01"
                            max={total}
                            step="0.01"
                            placeholder={formatMoney(total)}
                            value={draft}
                            onChange={(e) =>
                              setRefundAmountDraft((prev) => ({
                                ...prev,
                                [dispute.id]: e.target.value,
                              }))
                            }
                            className="w-40"
                          />
                          {badRefund && (
                            <p className="mt-1 text-xs text-destructive">
                              Enter an amount between $0.01 and {formatMoney(total)}.
                            </p>
                          )}
                        </div>
                      )}
                      {!canRefund && target && (
                        <p className="text-xs text-muted-foreground">
                          Nothing to refund — the payment is {humanize(target.paymentStatus)}.
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {canRefund && (
                          <Button
                            size="sm"
                            disabled={isUpdating || badRefund}
                            onClick={() => resolve(dispute, "resolved_refunded")}
                          >
                            {target?.paymentStatus === "authorized" ? "Release hold" : "Refund"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isUpdating}
                          onClick={() => resolve(dispute, "resolved_denied")}
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => resolve(dispute, "resolved_other")}
                        >
                          Close without refund
                        </Button>
                        {isUpdating && (
                          <span className="self-center text-xs text-muted-foreground">Saving…</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          <Pagination meta={disputesPage?.meta} onPageChange={setPage} disabled={isFetching} />
        </CardContent>
      </Card>
    </div>
  );
}
