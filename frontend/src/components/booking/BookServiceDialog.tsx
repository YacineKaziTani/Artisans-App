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
import { useAbandonBooking, useCreateBooking } from "@/hooks/useBookings";
import { useServiceAvailability } from "@/hooks/useServices";
import { stripePromise } from "@/lib/stripe";
import { BookingPaymentForm } from "./BookingPaymentForm";
import type { OpeningHours, Service, Weekday } from "@/types";
import { getErrorMessage } from "@/lib/errors";
import {
  addDays,
  browserTimeZone,
  formatCalendarDate,
  formatTimeIn,
  hasOpeningHours,
  todayIn,
  WEEKDAYS,
  zoneLabel,
} from "@/lib/schedule";
import { track } from "@/lib/analytics";

/** "YYYY-MM-DDTHH:mm" in local time, the format datetime-local expects. */
function localDateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const DAYS_SHOWN = 14;

function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7].key;
}

/** Day picker + the free slots on that day, for shops with opening hours. */
function SlotPicker({
  service,
  hours,
  timezone,
  value,
  onChange,
}: {
  service: Service;
  hours: OpeningHours;
  timezone: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(todayIn(timezone), i));
  const firstOpen = days.find((d) => (hours[weekdayOf(d)]?.length ?? 0) > 0) ?? days[0];
  const [date, setDate] = useState(firstOpen);
  const availability = useServiceAvailability(service.id, date, true);
  const viewerZone = browserTimeZone();
  const differentZone = viewerZone !== timezone;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Choose a day">
        {days.map((d) => {
          const open = (hours[weekdayOf(d)]?.length ?? 0) > 0;
          return (
            <button
              key={d}
              type="button"
              disabled={!open}
              aria-pressed={d === date}
              onClick={() => {
                setDate(d);
                onChange("");
              }}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs ${
                d === date
                  ? "border-primary bg-brand-50 text-foreground"
                  : open
                    ? "border-border hover:border-primary/40"
                    : "border-border text-muted-foreground/50 line-through"
              }`}
            >
              {formatCalendarDate(d)}
            </button>
          );
        })}
      </div>

      {availability.isLoading && <div className="skeleton h-16" />}
      {availability.isError && (
        <p className="text-sm text-destructive">
          {getErrorMessage(availability.error, "Couldn't load the available times.")}
        </p>
      )}
      {availability.data && availability.data.slots.length === 0 && (
        <p className="text-sm text-muted-foreground">No free times that day — try another one.</p>
      )}
      {availability.data && availability.data.slots.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="group" aria-label="Choose a time">
          {availability.data.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={slot === value}
              onClick={() => onChange(slot)}
              className={`rounded-md border px-2 py-1.5 text-sm tabular-nums ${
                slot === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
              }`}
            >
              {formatTimeIn(slot, timezone)}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Times are in the shop's time zone ({zoneLabel(timezone)})
        {differentZone && value ? ` — that's ${formatTimeIn(value, viewerZone)} your time.` : "."}
      </p>
    </div>
  );
}

export function BookServiceDialog({
  service,
  shop,
  open,
  onOpenChange,
}: {
  service: Service;
  /** The shop's hours decide whether clients pick a slot or request any time. */
  shop?: { timezone?: string; openingHours?: OpeningHours | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const createBooking = useCreateBooking();
  const abandonBooking = useAbandonBooking();
  const slotMode = hasOpeningHours(shop?.openingHours);

  const reset = () => {
    setScheduledAt("");
    setNotes("");
    setClientSecret(null);
    setConfirmed(false);
    createBooking.reset();
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      // Closing before the card was authorized: the booking is already
      // holding this time slot, so release it now rather than when it expires.
      const unpaidBookingId = createBooking.data?.booking.id;
      if (unpaidBookingId && !confirmed) abandonBooking.mutate(unpaidBookingId);
      reset();
    }
    onOpenChange(next);
  };

  const handleRequestBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return;
    createBooking.mutate(
      {
        serviceId: service.id,
        // Slot mode already holds an ISO instant; the free-form picker holds local time.
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
            <DialogTitle>Payment Authorized</DialogTitle>
            <DialogDescription>
              Your card is on hold — nothing is charged yet. The artisan has been emailed
              your request, and a confirmation is on its way to your inbox.
              You'll be charged once they confirm the booking — if they can't
              take it, the hold is released and you're never charged.
            </DialogDescription>
            <Button onClick={() => handleClose(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : clientSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Authorize Payment for {service.name}</DialogTitle>
              <DialogDescription>
                ${Number(service.price).toFixed(2)} — your card is authorized
                now and charged only once the artisan confirms.
              </DialogDescription>
            </DialogHeader>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <BookingPaymentForm
                onSuccess={() => {
                  track("Payment authorized", { kind: "booking" });
                  setConfirmed(true);
                }}
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
                {service.durationMinutes
                  ? ` · about ${service.durationMinutes} minutes`
                  : service.duration
                    ? ` · ${service.duration}`
                    : ""}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRequestBooking} className="space-y-4">
              {createBooking.isError && (
                <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-sm">
                  {getErrorMessage(
                    createBooking.error,
                    "Couldn't start the booking. Please try again.",
                  )}
                </div>
              )}
              {slotMode ? (
                <div className="space-y-2">
                  <Label>Pick a time</Label>
                  <SlotPicker
                    service={service}
                    hours={shop!.openingHours!}
                    timezone={shop?.timezone || "UTC"}
                    value={scheduledAt}
                    onChange={setScheduledAt}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Date & time</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    min={localDateTimeInputValue(new Date())}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This artisan confirms each request — suggest the time that suits you.
                  </p>
                </div>
              )}
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
                className="w-full btn-gradient text-white"
                disabled={createBooking.isPending || !scheduledAt}
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
