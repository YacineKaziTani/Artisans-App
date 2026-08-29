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
  fulfilled: "bg-jade-50 text-jade-600 border-jade-500/25",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-muted text-foreground/80 border-border",
  authorized: "bg-sky-100 text-sky-800 border-sky-200",
  paid: "bg-jade-50 text-jade-600 border-jade-500/25",
  refunded: "bg-brand-100 text-primary border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

export default function AdminOrdersPage() {
  const { data: orders, isLoading, isError } = useAdminOrders();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground">All product orders across the platform</p>
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
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4 text-sm">
              Couldn't load orders.
            </p>
          )}

          {!isLoading && !isError && (orders ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">No orders yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (orders ?? []).map((order) => (
              <div
                key={order.id}
                className="border border-border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {order.product?.title} × {order.quantity}
                  </p>
                  {order.variantLabel && (
                    <p className="text-xs text-muted-foreground">{order.variantLabel}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
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
