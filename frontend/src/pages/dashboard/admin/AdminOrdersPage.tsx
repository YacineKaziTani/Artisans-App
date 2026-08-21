import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminOrders } from "@/hooks/useOrders";
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

export default function AdminOrdersPage() {
  const { data: orders, isLoading, isError } = useAdminOrders();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600">All product orders across the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>{orders?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
              Couldn't load orders.
            </p>
          )}

          {!isLoading && !isError && (orders ?? []).length === 0 && (
            <p className="text-gray-600 text-sm">No orders yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (orders ?? []).map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {order.product?.title} × {order.quantity}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.shop?.shopName} · {order.client?.name} · $
                    {Number(order.totalAmount).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
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
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
