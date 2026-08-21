import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBooking } from "@/hooks/useBookings";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "./BookingPaymentForm";
import type { Service } from "@/types";

export function BookServiceDialog({
  service,
  open,
  onOpenChange,
}: {
  service: Service;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const createBooking = useCreateBooking();

  const reset = () => {
    setScheduledAt("");
    setNotes("");
    setClientSecret(null);
    setConfirmed(false);
    createBooking.reset();
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleRequestBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return;
    createBooking.mutate(
      {
        serviceId: service.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes || undefined,
      },
      {
        onSuccess: (result) => setClientSecret(result.clientSecret),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {confirmed ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">✅</div>
            <DialogTitle>Booking Confirmed</DialogTitle>
            <DialogDescription>
              Your payment went through and the artisan has been notified.
            </DialogDescription>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : clientSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Pay for {service.name}</DialogTitle>
              <DialogDescription>
                ${Number(service.price).toFixed(2)} — payment is required to
                confirm your booking.
              </DialogDescription>
            </DialogHeader>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <BookingPaymentForm
                onSuccess={() => setConfirmed(true)}
                onCancel={() => handleClose(false)}
              />
            </Elements>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Book {service.name}</DialogTitle>
              <DialogDescription>
                ${Number(service.price).toFixed(2)}
                {service.duration ? ` · ${service.duration}` : ""}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRequestBooking} className="space-y-4">
              {createBooking.isError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                  Couldn't start the booking. Please try again.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Date & time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the artisan should know"
                  rows={3}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                disabled={createBooking.isPending}
              >
                {createBooking.isPending ? "Starting..." : "Continue to Payment"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
