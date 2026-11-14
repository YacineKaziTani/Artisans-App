import { Package } from "lucide-react";
import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminOrders } from "@/hooks/useOrders";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";



export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const { data: ordersPage, isLoading, isError, isFetching } = useAdminOrders({ page });
  const orders = ordersPage?.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Orders" description="All product orders across the platform" icon={Package} />

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>{ordersPage?.meta.total ?? 0} total</CardDescription>
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
            <p className="alert-error">
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
                  <StatusBadge status={order.status} />
                  <StatusBadge status={order.paymentStatus} />
                </div>
              </div>
            ))}
        <Pagination meta={ordersPage?.meta} onPageChange={setPage} disabled={isFetching} />
        </CardContent>
      </Card>
    </div>
  );
}
