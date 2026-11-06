// Opening hours and appointment slots, worked out in the shop's own time
// zone (IANA names like "Europe/Paris"), using only the built-in Intl API.

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** "HH:MM", 24-hour, local to the shop. */
export interface TimeRange {
  open: string;
  close: string;
}

/** A missing or empty day means closed. */
export type OpeningHours = Partial<Record<Weekday, TimeRange[]>>;

export interface Interval {
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** True when at least one day has hours — otherwise the shop takes requests for any time. */
export function hasOpeningHours(hours: OpeningHours | null | undefined): hours is OpeningHours {
  return Boolean(hours && WEEKDAYS.some((d) => (hours[d]?.length ?? 0) > 0));
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** The wall-clock date, time and weekday of an instant in `tz`. */
export function localParts(date: Date, tz: string) {
  const parts = Object.fromEntries(
    formatterFor(tz).formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekday = parts.weekday.slice(0, 3).toLowerCase() as Weekday;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday,
    utcGuess: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)),
  };
}

/** Minutes `tz` is ahead of UTC at that instant (e.g. +60 for Paris in winter). */
function offsetMinutes(date: Date, tz: string) {
  const wholeMinute = new Date(Math.floor(date.getTime() / 60_000) * 60_000);
  return Math.round((localParts(wholeMinute, tz).utcGuess - wholeMinute.getTime()) / 60_000);
}

/** The instant at which the clock in `tz` reads `date` `time` ("YYYY-MM-DD", "HH:MM"). */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset around daylight-saving changes.
  const first = offsetMinutes(new Date(asIfUtc), tz);
  const candidate = asIfUtc - first * 60_000;
  const second = offsetMinutes(new Date(candidate), tz);
  return new Date(second === first ? candidate : asIfUtc - second * 60_000);
}

/** The weekday of a calendar date (no time zone involved). */
export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  const index = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  return WEEKDAYS[index];
}

/**
 * Whether [start, end) sits inside one of the day's opening ranges, read
 * in the shop's time zone. Appointments can't run past midnight.
 */
export function withinOpeningHours(hours: OpeningHours, tz: string, start: Date, end: Date): boolean {
  const s = localParts(start, tz);
  const lastMinute = localParts(new Date(end.getTime() - 60_000), tz);
  if (lastMinute.date !== s.date) return false;
  const endMinutes = lastMinute.minutes + 1;
  return (hours[s.weekday] ?? []).some(
    (r) => toMinutes(r.open) <= s.minutes && endMinutes <= toMinutes(r.close),
  );
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Bookable start times on one calendar day (in the shop's time zone):
 * every `stepMinutes` through each opening range, keeping the ones where
 * the whole appointment fits, starts after `notBefore`, and doesn't overlap
 * a busy interval.
 */
export function slotsForDate(options: {
  hours: OpeningHours;
  tz: string;
  date: string;
  durationMinutes: number;
  stepMinutes: number;
  busy: Interval[];
  notBefore: Date;
}): Date[] {
  const { hours, tz, date, durationMinutes, stepMinutes, busy, notBefore } = options;
  const slots: Date[] = [];
  for (const range of hours[weekdayOf(date)] ?? []) {
    const close = toMinutes(range.close);
    for (let t = toMinutes(range.open); t + durationMinutes <= close; t += stepMinutes) {
      const start = zonedToUtc(date, fromMinutes(t), tz);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      // A clock time skipped by a daylight-saving jump lands elsewhere — drop it.
      if (localParts(start, tz).date !== date || localParts(start, tz).minutes !== t) continue;
      if (start <= notBefore) continue;
      if (busy.some((b) => overlaps({ start, end }, b))) continue;
      slots.push(start);
    }
  }
  return slots;
}

/** The UTC window covering a calendar day in `tz` (for loading that day's bookings). */
export function dayWindow(date: string, tz: string): Interval {
  const start = zonedToUtc(date, "00:00", tz);
  return { start, end: new Date(start.getTime() + DAY_MS + 60 * 60 * 1000) };
}
