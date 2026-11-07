import { Clock } from "lucide-react";

const HOLD_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/**
 * "Fulfil by Mon 12 Nov" on orders/bookings whose card is on hold. Holds
 * last about 7 days; after that the sale is cancelled automatically.
 * Turns red in the last two days.
 */
export function HoldDeadline({
  since,
  verb,
  now,
}: {
  /** When the card was authorized (or the order was placed, for older ones). */
  since: string;
  verb: "Fulfil" | "Confirm";
  /** Passed in so render stays pure. */
  now: number;
}) {
  const deadline = new Date(new Date(since).getTime() + HOLD_DAYS * DAY);
  const left = deadline.getTime() - now;
  if (left <= 0) return null;
  const urgent = left < 2 * DAY;
  const label = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(deadline);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${urgent ? "text-destructive" : "text-muted-foreground"}`}
      title="The client's card is held for about 7 days. After that the hold lapses and this is cancelled automatically."
    >
      <Clock className="size-3.5" aria-hidden="true" />
      {verb} by {label}
      {urgent ? " — card hold ends soon" : ""}
    </span>
  );
}
