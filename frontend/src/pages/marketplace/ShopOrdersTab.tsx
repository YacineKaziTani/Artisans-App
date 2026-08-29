import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShopOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import { isAxiosError } from "axios";
import type { OrderStatus } from "@/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  fulfilled: "bg-jade-50 text-jade-600 border-jade-500/25",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-muted text-foreground/80 border-border",
  authorized: "bg-sky-100 text-sky-800 border-sky-200",
  paid: "bg-jade-50 text-jade-600 border-jade-500/25",
  partially_refunded: "bg-brand-100 text-primary border-border",
  refunded: "bg-brand-100 text-primary border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

export function ShopOrdersTab() {
  const { data: orders, isLoading, isError } = useShopOrders();
  const updateStatus = useUpdateOrderStatus();
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
                      {order.trackingInfo && (
                        <p className="text-xs text-muted-foreground">Tracking: {order.trackingInfo}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[order.status]}`}
                      >
                        {order.status}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${PAYMENT_STYLES[order.paymentStatus]}`}
                      >
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>

                  {order.status === "pending" && (
                    <div className="space-y-2">
                      {updateStatus.isError &&
                        updateStatus.variables?.id === order.id && (
                          <p className="p-2 bg-destructive/10 border border-destructive/25 rounded text-destructive text-xs">
                            {(isAxiosError(updateStatus.error) &&
                              updateStatus.error.response?.data?.message) ||
                              "Couldn't update this order. Please try again."}
                          </p>
                        )}
                      {order.paymentStatus === "authorized" && (
                        <p className="text-xs text-muted-foreground">
                          Marking fulfilled will charge the client's card. Cancelling releases the hold instead.
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
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus.mutate({
                              id: order.id,
                              status: "fulfilled",
                              trackingInfo: trackingDraft[order.id],
                            })
                          }
                        >
                          Mark Fulfilled
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus.mutate({ id: order.id, status: "cancelled" })
                          }
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
      </CardContent>
    </Card>
  );
}
