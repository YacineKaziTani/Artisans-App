import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useShopOrders, useUpdateOrderStatus } from "@/hooks/useOrders";
import type { OrderStatus } from "@/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  fulfilled: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-gray-100 text-gray-700 border-gray-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  refunded: "bg-orange-100 text-orange-800 border-orange-300",
  failed: "bg-red-100 text-red-800 border-red-300",
};

export function ShopOrdersTab() {
  const { data: orders, isLoading, isError } = useShopOrders();
  const updateStatus = useUpdateOrderStatus();

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
              <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
            Couldn't load your orders right now.
          </p>
        )}

        {!isLoading && !isError && (orders ?? []).length === 0 && (
          <p className="text-gray-600 text-sm">No orders yet.</p>
        )}

        {!isLoading && !isError && (orders ?? []).length > 0 && (
          <div className="space-y-4">
            {orders!.map((order) => {
              const isUpdating =
                updateStatus.isPending && updateStatus.variables?.id === order.id;

              return (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {order.product?.title} × {order.quantity}
                      </p>
                      <p className="text-sm text-gray-600">
                        {order.client?.name} · $
                        {Number(order.totalAmount).toFixed(2)}
                      </p>
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={isUpdating}
                        onClick={() =>
                          updateStatus.mutate({ id: order.id, status: "fulfilled" })
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
