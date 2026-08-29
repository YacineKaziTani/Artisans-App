import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useShopBookings, useUpdateBookingStatus } from "@/hooks/useBookings";
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

export function ShopBookingsTab() {
  const { data: bookings, isLoading, isError } = useShopBookings();
  const updateStatus = useUpdateBookingStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings</CardTitle>
        <CardDescription>Requests and appointments for your shop</CardDescription>
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
            Couldn't load your bookings right now.
          </p>
        )}

        {!isLoading && !isError && (bookings ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">No bookings yet.</p>
        )}

        {!isLoading && !isError && (bookings ?? []).length > 0 && (
          <div className="space-y-4">
            {bookings!.map((booking) => {
              const isUpdating =
                updateStatus.isPending &&
                updateStatus.variables?.id === booking.id;

              return (
                <div
                  key={booking.id}
                  className="border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {booking.service?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.client?.name} ·{" "}
                        {new Date(booking.scheduledAt).toLocaleString()}
                      </p>
                      {booking.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          "{booking.notes}"
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
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

                  {(booking.status === "pending" || booking.status === "confirmed") && (
                    <div className="space-y-1">
                      {booking.status === "pending" && booking.paymentStatus === "authorized" && (
                        <p className="text-xs text-muted-foreground">
                          Confirming will charge the client's card. Cancelling releases the hold instead.
                        </p>
                      )}
                      <div className="flex gap-2">
                        {booking.status === "pending" && (
                          <Button
                            size="sm"
                            disabled={isUpdating}
                            onClick={() =>
                              updateStatus.mutate({ id: booking.id, status: "confirmed" })
                            }
                          >
                            Confirm
                          </Button>
                        )}
                        {booking.status === "confirmed" && (
                          <Button
                            size="sm"
                            disabled={isUpdating}
                            onClick={() =>
                              updateStatus.mutate({ id: booking.id, status: "completed" })
                            }
                          >
                            Mark Completed
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus.mutate({ id: booking.id, status: "cancelled" })
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
