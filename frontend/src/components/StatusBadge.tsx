type Tone = "warning" | "success" | "danger" | "info" | "neutral" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
  success: "bg-jade-50 text-jade-600 border-jade-500/25",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-sky-100 text-sky-800 border-sky-200",
  neutral: "bg-muted text-foreground/80 border-border",
  brand: "bg-brand-100 text-primary border-border",
};

/**
 * Every status the API sends — bookings, orders, payments, shops, reports
 * and disputes — mapped to one colour. These used to be copied into eight
 * pages, and the copies had drifted (some had no colour for
 * "partially_refunded", so that badge rendered unstyled).
 */
const STATUS_TONES: Record<string, Tone> = {
  // workflow
  pending: "warning",
  open: "warning",
  confirmed: "success",
  fulfilled: "success",
  completed: "info",
  cancelled: "danger",
  // payments
  unpaid: "neutral",
  authorized: "info",
  paid: "success",
  partially_refunded: "brand",
  refunded: "brand",
  failed: "danger",
  // shops
  active: "success",
  suspended: "danger",
  closed: "neutral",
  verified: "info",
  // moderation
  actioned: "success",
  dismissed: "neutral",
  resolved_refunded: "success",
  resolved_denied: "danger",
  resolved_other: "neutral",
};

export function StatusBadge({
  status,
  label,
  tone,
  className = "",
}: {
  status: string;
  /** Defaults to the status with underscores as spaces. */
  label?: string;
  /** Overrides the colour picked from the status. */
  tone?: Tone;
  className?: string;
}) {
  const classes = TONE_CLASSES[tone ?? STATUS_TONES[status] ?? "neutral"];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${classes} ${className}`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
