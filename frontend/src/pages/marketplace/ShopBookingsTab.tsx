import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useShopBookings, useUpdateBookingStatus } from "@/hooks/useBookings";
import type { BookingStatus } from "@/types";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-gray-100 text-gray-700 border-gray-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  refunded: "bg-orange-100 text-orange-800 border-orange-300",
  failed: "bg-red-100 text-red-800 border-red-300",
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
              <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
            Couldn't load your bookings right now.
          </p>
        )}

        {!isLoading && !isError && (bookings ?? []).length === 0 && (
          <p className="text-gray-600 text-sm">No bookings yet.</p>
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
                  className="border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {booking.service?.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {booking.client?.name} ·{" "}
                        {new Date(booking.scheduledAt).toLocaleString()}
                      </p>
                      {booking.notes && (
                        <p className="text-sm text-gray-500 mt-1">
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
