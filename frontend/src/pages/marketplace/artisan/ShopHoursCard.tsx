import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateShopHours } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import { allTimeZones, browserTimeZone, hasOpeningHours, WEEKDAYS, zoneLabel } from "@/lib/schedule";
import type { OpeningHours, Shop, TimeRange, Weekday } from "@/types";

const DEFAULT_RANGE: TimeRange = { open: "09:00", close: "17:00" };

/**
 * Time zone and weekly opening hours. With hours set, clients pick from the
 * free slots inside them; without, they request any time and the artisan
 * confirms or declines each booking.
 */
export function ShopHoursCard({ shop }: { shop: Shop }) {
  const save = useUpdateShopHours();
  // A shop that never set a zone is on the "UTC" default — suggest the
  // artisan's own zone instead.
  const [timezone, setTimezone] = useState(
    shop.timezone && (shop.timezone !== "UTC" || hasOpeningHours(shop.openingHours))
      ? shop.timezone
      : browserTimeZone(),
  );
  const [fixedHours, setFixedHours] = useState(hasOpeningHours(shop.openingHours));
  const [hours, setHours] = useState<OpeningHours>(
    hasOpeningHours(shop.openingHours)
      ? shop.openingHours
      : { mon: [DEFAULT_RANGE], tue: [DEFAULT_RANGE], wed: [DEFAULT_RANGE], thu: [DEFAULT_RANGE], fri: [DEFAULT_RANGE] },
  );
  const zones = useMemo(() => allTimeZones(), []);

  const setRange = (day: Weekday, index: number, field: keyof TimeRange, value: string) =>
    setHours((h) => ({
      ...h,
      [day]: (h[day] ?? []).map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
  // A second period starts an hour after the last one ends, for 3 hours
  // (e.g. 09:00–12:00 → add 13:00–16:00); the artisan adjusts from there.
  const addRange = (day: Weekday) =>
    setHours((h) => {
      const ranges = h[day] ?? [];
      const last = ranges[ranges.length - 1];
      if (!last) return { ...h, [day]: [DEFAULT_RANGE] };
      const [hh, mm] = last.close.split(":").map(Number);
      const start = Math.min(hh * 60 + mm + 60, 22 * 60);
      const end = Math.min(start + 180, 23 * 60 + 59);
      const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return { ...h, [day]: [...ranges, { open: clock(start), close: clock(end) }] };
    });
  const removeRange = (day: Weekday, index: number) =>
    setHours((h) => ({ ...h, [day]: (h[day] ?? []).filter((_, i) => i !== index) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({ timezone, openingHours: fixedHours ? hours : null });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening hours</CardTitle>
        <CardDescription>
          When clients can book your services. Times are in your shop's time zone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {save.isError && (
            <p className="alert-error">{getErrorMessage(save.error, "Couldn't save your hours.")}</p>
          )}
          {save.isSuccess && !save.isPending && (
            <p className="text-sm text-jade-600">Saved.</p>
          )}

          <div className="max-w-sm">
            <label htmlFor="shop-timezone" className="field-label">Time zone</label>
            <select
              id="shop-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => (
                <option key={z} value={z}>{zoneLabel(z)}</option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="field-label">How clients book</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="hours-mode" checked={fixedHours} onChange={() => setFixedHours(true)} className="mt-1" />
              <span>
                <span className="font-medium">Set opening hours</span> — clients pick a free time slot inside them.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="hours-mode" checked={!fixedHours} onChange={() => setFixedHours(false)} className="mt-1" />
              <span>
                <span className="font-medium">By request</span> — clients ask for any time and you confirm or decline.
              </span>
            </label>
          </fieldset>

          {fixedHours && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {WEEKDAYS.map(({ key, label }) => {
                const ranges = hours[key] ?? [];
                return (
                  <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                    <label className="flex w-32 items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={ranges.length > 0}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [key]: e.target.checked ? [DEFAULT_RANGE] : [] }))
                        }
                      />
                      {label}
                    </label>
                    {ranges.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {ranges.map((range, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <Input
                              type="time"
                              aria-label={`${label} opens`}
                              value={range.open}
                              onChange={(e) => setRange(key, i, "open", e.target.value)}
                              className="h-8 w-[7.5rem] text-sm"
                              required
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                              type="time"
                              aria-label={`${label} closes`}
                              value={range.close}
                              onChange={(e) => setRange(key, i, "close", e.target.value)}
                              className="h-8 w-[7.5rem] text-sm"
                              required
                            />
                            {ranges.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRange(key, i)}
                                aria-label={`Remove this ${label} period`}
                                className="rounded p-1 text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-4" />
                              </button>
                            )}
                          </span>
                        ))}
                        {ranges.length < 3 && (
                          <button
                            type="button"
                            onClick={() => addRange(key)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Plus className="size-3.5" /> Add hours
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save hours"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
