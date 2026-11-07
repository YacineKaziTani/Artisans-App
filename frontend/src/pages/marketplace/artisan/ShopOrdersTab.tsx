import { useState } from "react";
import { HoldDeadline } from "@/components/HoldDeadline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShopOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import { getErrorMessage } from "@/lib/errors";
import { useConfirm } from "@/hooks/useConfirm";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";



export function ShopOrdersTab() {
  const [page, setPage] = useState(1);
  // Read once: deadlines don't need to tick, and render must stay pure.
  const [now] = useState(Date.now);
  const { data: ordersPage, isLoading, isError, isFetching } = useShopOrders({ page });
  const orders = ordersPage?.data;
  const updateStatus = useUpdateOrderStatus();
  const confirm = useConfirm();
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>Product orders placed with your shop</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
            Couldn't load your orders right now.
          </p>
        )}

        {!isLoading && !isError && (orders ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">No orders yet.</p>
        )}

        {!isLoading && !isError && (orders ?? []).length > 0 && (
          <div className="space-y-4">
            {orders!.map((order) => {
              const isUpdating =
                updateStatus.isPending && updateStatus.variables?.id === order.id;

              return (
                <div
                  key={order.id}
                  className="border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {order.product?.title} × {order.quantity}
                      </p>
                      {order.variantLabel && (
                        <p className="text-xs text-muted-foreground">{order.variantLabel}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {order.client?.name} · $
                        {Number(order.totalAmount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.deliveryMethod === "delivery" ? "🚚 Delivery" : "🏬 Pickup"}
                        {order.shippingAddress && ` · ${order.shippingAddress}`}
                      </p>
                      {order.deliveryMethod === "delivery" && order.status === "fulfilled" && (
                        <p className="text-xs mt-1 font-medium text-jade-600">
                          {order.deliveredAt
                            ? `✓ Client confirmed delivery ${new Date(order.deliveredAt).toLocaleDateString()}`
                            : "Shipped — waiting for the client to confirm it arrived"}
                        </p>
                      )}
                      {order.trackingInfo && (
                        <p className="text-xs text-muted-foreground">Tracking: {order.trackingInfo}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={order.status} />
                      <StatusBadge status={order.paymentStatus} />
                      {order.status === "pending" && order.paymentStatus === "authorized" && (
                        <HoldDeadline since={order.authorizedAt ?? order.createdAt} verb="Fulfil" now={now} />
                      )}
                    </div>
                  </div>

                  {order.status === "pending" && (
                    <div className="space-y-2">
                      {updateStatus.isError &&
                        updateStatus.variables?.id === order.id && (
                          <p className="p-2 bg-destructive/10 border border-destructive/25 rounded text-destructive text-xs">
                            {getErrorMessage(
                              updateStatus.error,
                              "Couldn't update this order. Please try again.",
                            )}
                          </p>
                        )}
                      {order.paymentStatus === "authorized" && (
                        <p className="text-xs text-muted-foreground">
                          {order.checkoutGroupId
                            ? "Part of a multi-item order: the card is charged for the fulfilled items once every item is fulfilled or cancelled."
                            : "Marking fulfilled will charge the client's card. Cancelling releases the hold instead."}
                        </p>
                      )}
                      {order.paymentStatus === "failed" && (
                        <p className="text-xs text-destructive">
                          The client's card was declined — wait for them to complete payment before fulfilling.
                        </p>
                      )}
                      {order.deliveryMethod === "delivery" && (
                        <Input
                          placeholder="Tracking number (optional)"
                          value={trackingDraft[order.id] ?? ""}
                          onChange={(e) =>
                            setTrackingDraft((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                        />
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={
                            isUpdating ||
                            !(order.paymentStatus === "authorized" || order.paymentStatus === "paid")
                          }
                          onClick={() =>
                            updateStatus.mutate({
                              id: order.id,
                              status: "fulfilled",
                              trackingInfo: trackingDraft[order.id],
                            })
                          }
                        >
                          {order.deliveryMethod === "delivery" ? "Mark Shipped" : "Mark Fulfilled"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isUpdating}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Cancel this order?",
                              description:
                                order.paymentStatus === "paid"
                                  ? "The client is refunded for this item and its stock is put back."
                                  : "The client isn't charged for it, and its stock is put back.",
                              confirmLabel: "Cancel order",
                              cancelLabel: "Keep it",
                              destructive: true,
                            });
                            if (ok) updateStatus.mutate({ id: order.id, status: "cancelled" });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Pagination meta={ordersPage?.meta} onPageChange={setPage} disabled={isFetching} />
      </CardContent>
    </Card>
  );
}
