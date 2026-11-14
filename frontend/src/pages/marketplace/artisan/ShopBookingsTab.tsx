import { useState } from "react";
import { HoldDeadline } from "@/components/HoldDeadline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useShopBookings, useUpdateBookingStatus } from "@/hooks/useBookings";
import { Pagination } from "@/components/Pagination";
import { useConfirm } from "@/hooks/useConfirm";
import { getErrorMessage } from "@/lib/errors";
import { StatusBadge } from "@/components/StatusBadge";



export function ShopBookingsTab() {
  const [page, setPage] = useState(1);
  const { data: bookingsPage, isLoading, isError, isFetching } = useShopBookings({ page });
  const bookings = bookingsPage?.data;
  const updateStatus = useUpdateBookingStatus();
  const confirm = useConfirm();
  // Captured once per mount (render must stay pure); refetches re-render the list anyway.
  const [now] = useState(Date.now);

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
          <p className="alert-error">
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
              // Mirrors the API: confirm needs an authorized/paid card, and
              // "completed" only makes sense once the appointment has happened.
              const payable =
                booking.paymentStatus === "authorized" || booking.paymentStatus === "paid";
              const appointmentPassed =
                new Date(booking.scheduledAt).getTime() <= now;

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
                      <StatusBadge status={booking.status} />
                      <StatusBadge status={booking.paymentStatus} />
                      {booking.status === "pending" && booking.paymentStatus === "authorized" && (
                        <HoldDeadline since={booking.authorizedAt ?? booking.createdAt} verb="Confirm" now={now} />
                      )}
                    </div>
                  </div>

                  {(booking.status === "pending" || booking.status === "confirmed") && (
                    <div className="space-y-1">
                      {/* Errors used to be swallowed here — a failed capture
                          (expired hold) looked like the button did nothing. */}
                      {updateStatus.isError &&
                        updateStatus.variables?.id === booking.id && (
                          <p className="alert-error px-3 py-2 text-xs">
                            {getErrorMessage(
                              updateStatus.error,
                              "Couldn't update this booking. Please try again.",
                            )}
                          </p>
                        )}
                      {booking.status === "pending" && booking.paymentStatus === "authorized" && (
                        <p className="text-xs text-muted-foreground">
                          Confirming will charge the client's card. Cancelling releases the hold instead.
                        </p>
                      )}
                      {booking.status === "pending" && booking.paymentStatus === "failed" && (
                        <p className="text-xs text-destructive">
                          The client's card was declined — wait for them to complete payment before confirming.
                        </p>
                      )}
                      <div className="flex gap-2">
                        {booking.status === "pending" && (
                          <Button
                            size="sm"
                            disabled={isUpdating || !payable}
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
                            disabled={isUpdating || !appointmentPassed}
                            title={
                              appointmentPassed
                                ? undefined
                                : "Available once the appointment time has passed"
                            }
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
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Cancel this booking?",
                              description:
                                booking.paymentStatus === "paid"
                                  ? "The client is refunded in full."
                                  : "The hold on the client's card is released and they aren't charged.",
                              confirmLabel: "Cancel booking",
                              cancelLabel: "Keep it",
                              destructive: true,
                            });
                            if (ok) {
                              updateStatus.mutate({ id: booking.id, status: "cancelled" });
                            }
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

        <Pagination meta={bookingsPage?.meta} onPageChange={setPage} disabled={isFetching} />
      </CardContent>
    </Card>
  );
}
