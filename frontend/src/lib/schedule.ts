import type { OpeningHours, Weekday } from "@/types";

export const WEEKDAYS: { key: Weekday; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

export function hasOpeningHours(hours: OpeningHours | null | undefined): hours is OpeningHours {
  return Boolean(hours && WEEKDAYS.some((d) => (hours[d.key]?.length ?? 0) > 0));
}

/** The visitor's own zone, e.g. "Europe/Paris". */
export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Every IANA zone the browser knows (falls back to a short list on old browsers). */
export function allTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];
  return zones.length ? zones : ["UTC", browserTimeZone()].filter((z, i, a) => a.indexOf(z) === i);
}

export function zoneLabel(tz: string) {
  return tz.replace(/_/g, " ");
}

/** "9:00 AM" — an instant shown as the clock reads in `tz`. */
export function formatTimeIn(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone: tz }).format(new Date(iso));
}

/** "Mon 9 Dec" for a YYYY-MM-DD calendar date. */
export function formatCalendarDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Today's calendar date in `tz`, as YYYY-MM-DD. */
export function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/** YYYY-MM-DD plus `days`. */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "9:00–12:00, 14:00–18:00" for one day, or "Closed". */
export function describeDay(hours: OpeningHours, day: Weekday) {
  const ranges = hours[day] ?? [];
  return ranges.length ? ranges.map((r) => `${r.open}–${r.close}`).join(", ") : "Closed";
}
