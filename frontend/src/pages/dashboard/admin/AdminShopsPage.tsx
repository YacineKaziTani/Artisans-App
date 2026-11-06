import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { useAdminShops, useUpdateShopStatusAdmin } from "@/hooks/useAdminShops";
import { useResolveVerification } from "@/hooks/useShops";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import type { Shop } from "@/types";
import { ShopPreviewDialog } from "./ShopPreviewDialog";
import { StatusBadge } from "@/components/StatusBadge";


const STATUS_FILTERS: { value: Shop["status"] | undefined; label: string }[] = [
  { value: "pending", label: "Awaiting approval" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
  { value: undefined, label: "All" },
];

export default function AdminShopsPage() {
  const [status, setStatus] = useState<Shop["status"] | undefined>("pending");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useAdminShops({ status, page });
  const updateStatus = useUpdateShopStatusAdmin();
  const resolveVerification = useResolveVerification();
  const confirm = useConfirm();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const shops = data?.data ?? [];
  const actionError = updateStatus.error ?? resolveVerification.error;

  const setShopStatus = async (shop: Shop, next: Shop["status"]) => {
    const suspending = next === "suspended";
    const ok = await confirm({
      title: suspending
        ? `Suspend ${shop.shopName}?`
        : shop.status === "pending"
          ? `Approve ${shop.shopName}?`
          : `Reactivate ${shop.shopName}?`,
      description: suspending
        ? "It disappears from the marketplace and can't take new bookings or orders. The owner can't reopen it themselves."
        : "It becomes visible on the marketplace and can take bookings and orders (once payouts are set up).",
      confirmLabel: suspending ? "Suspend shop" : "Approve",
      destructive: suspending,
    });
    if (ok) updateStatus.mutate({ id: shop.id, status: next });
  };

  const rejectVerification = async (shop: Shop) => {
    const ok = await confirm({
      title: `Reject ${shop.shopName}'s verification request?`,
      description: "The owner sees the rejection and can request verification again.",
      confirmLabel: "Reject",
      destructive: true,
    });
    if (ok) {
      resolveVerification.mutate({
        id: shop.id,
        status: "rejected",
        note: "Did not meet verification criteria",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Shops</h1>
        <p className="text-muted-foreground">Approve new shops and moderate existing ones</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              status === filter.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground/80 border-border"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {STATUS_FILTERS.find((f) => f.value === status)?.label ?? "Shops"}
          </CardTitle>
          <CardDescription>{data?.meta.total ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Boolean(actionError) && (
            <p className="alert-error">{getErrorMessage(actionError)}</p>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
              Couldn't load shops.
            </p>
          )}

          {!isLoading && !isError && shops.length === 0 && (
            <p className="text-muted-foreground text-sm">No shops here.</p>
          )}

          {!isLoading &&
            !isError &&
            shops.map((shop) => {
              const isUpdating =
                updateStatus.isPending && updateStatus.variables?.id === shop.id;
              const isResolvingVerification =
                resolveVerification.isPending &&
                resolveVerification.variables?.id === shop.id;

              return (
                <div
                  key={shop.id}
                  className="flex items-center justify-between border border-border rounded-lg p-3 flex-wrap gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{shop.shopName}</p>
                    <p className="text-sm text-muted-foreground">
                      {shop.category?.name} · {shop.city ?? "—"}
                      {shop.owner?.email ? ` · ${shop.owner.name} (${shop.owner.email})` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={shop.status} />
                    <Button size="sm" variant="outline" onClick={() => setPreviewId(shop.id)}>
                      Preview
                    </Button>
                    {shop.verificationStatus === "verified" && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-sky-100 text-sky-800 border-sky-200">
                        ✓ verified
                      </span>
                    )}
                    {shop.verificationStatus === "pending" && (
                      <>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-muted text-foreground/80 border-border">
                          verification pending
                        </span>
                        <Button
                          size="sm"
                          disabled={isResolvingVerification}
                          onClick={() =>
                            resolveVerification.mutate({ id: shop.id, status: "verified" })
                          }
                        >
                          Approve Verification
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isResolvingVerification}
                          onClick={() => rejectVerification(shop)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {/* A closed shop was closed by its owner; only they reopen it. */}
                    {(shop.status === "pending" || shop.status === "suspended") && (
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => setShopStatus(shop, "active")}
                      >
                        {shop.status === "pending" ? "Approve" : "Reactivate"}
                      </Button>
                    )}
                    {shop.status !== "suspended" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isUpdating}
                        onClick={() => setShopStatus(shop, "suspended")}
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

          <Pagination meta={data?.meta} onPageChange={setPage} disabled={isFetching} />
        </CardContent>
      </Card>

      <ShopPreviewDialog shopId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}
