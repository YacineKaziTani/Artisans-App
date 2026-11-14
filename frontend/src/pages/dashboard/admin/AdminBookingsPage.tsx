import { Calendar } from "lucide-react";
import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminBookings } from "@/hooks/useBookings";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";



export default function AdminBookingsPage() {
  const [page, setPage] = useState(1);
  const { data: bookingsPage, isLoading, isError, isFetching } = useAdminBookings({ page });
  const bookings = bookingsPage?.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Bookings" description="All bookings across the platform" icon={Calendar} />

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>{bookingsPage?.meta.total ?? 0} total</CardDescription>
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
              Couldn't load bookings.
            </p>
          )}

          {!isLoading && !isError && (bookings ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">No bookings yet.</p>
          )}

          {!isLoading &&
            !isError &&
            (bookings ?? []).map((booking) => (
              <div
                key={booking.id}
                className="border border-border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {booking.service?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.shop?.shopName} · {booking.client?.name} ·{" "}
                    {new Date(booking.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={booking.status} />
                  <StatusBadge status={booking.paymentStatus} />
                </div>
              </div>
            ))}
        <Pagination meta={bookingsPage?.meta} onPageChange={setPage} disabled={isFetching} />
        </CardContent>
      </Card>
    </div>
  );
}
