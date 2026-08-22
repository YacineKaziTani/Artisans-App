import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminDisputes, useResolveDispute } from "@/hooks/useDisputes";
import type { DisputeStatus } from "@/types";

const STATUS_STYLES: Record<DisputeStatus, string> = {
  open: "bg-yellow-100 text-yellow-800 border-yellow-300",
  resolved_refunded: "bg-green-100 text-green-800 border-green-300",
  resolved_denied: "bg-red-100 text-red-800 border-red-300",
  resolved_other: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function AdminDisputesPage() {
  const [filter, setFilter] = useState<DisputeStatus | undefined>("open");
  const { data: disputes, isLoading, isError } = useAdminDisputes(filter);
  const resolveDispute = useResolveDispute();
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
        <p className="text-gray-600">
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
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-gray-700 border-gray-300"
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
                <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              Couldn't load disputes.
            </p>
          )}

          {!isLoading && !isError && (disputes ?? []).length === 0 && (
            <p className="text-gray-600 text-sm">No disputes here.</p>
          )}

          {!isLoading &&
            !isError &&
            (disputes ?? []).map((dispute) => {
              const isUpdating =
                resolveDispute.isPending &&
                resolveDispute.variables?.id === dispute.id;

              return (
                <div key={dispute.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {dispute.targetType} #{dispute.targetId.slice(0, 8)}
                      </p>
                      <p className="text-sm text-gray-600">
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
                  <p className="text-sm text-gray-800">"{dispute.reason}"</p>
                  {dispute.resolutionNote && (
                    <p className="text-xs text-gray-500">
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
                        className="w-full text-sm border border-gray-300 rounded-md p-2"
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          disabled={isUpdating}
                          onClick={() =>
                            resolveDispute.mutate({
                              id: dispute.id,
                              status: "resolved_refunded",
                              resolutionNote: noteDraft[dispute.id],
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
