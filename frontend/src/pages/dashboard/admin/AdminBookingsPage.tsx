import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminBookings } from "@/hooks/useBookings";
import type { BookingStatus } from "@/types";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-jade-50 text-jade-600 border-jade-500/25",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
  completed: "bg-sky-100 text-sky-800 border-sky-200",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-muted text-foreground/80 border-border",
  authorized: "bg-sky-100 text-sky-800 border-sky-200",
  paid: "bg-jade-50 text-jade-600 border-jade-500/25",
  refunded: "bg-brand-100 text-primary border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

export default function AdminBookingsPage() {
  const { data: bookings, isLoading, isError } = useAdminBookings();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Bookings</h1>
        <p className="text-muted-foreground">All bookings across the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>{bookings?.length ?? 0} total</CardDescription>
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
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[booking.status]}`}
                  >
                    {booking.status}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${PAYMENT_STYLES[booking.paymentStatus]}`}
                  >
                    {booking.paymentStatus}
                  </span>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
