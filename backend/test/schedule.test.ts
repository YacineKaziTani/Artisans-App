// Time-zone and opening-hours maths, including daylight-saving edges.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  localParts,
  slotsForDate,
  weekdayOf,
  withinOpeningHours,
  zonedToUtc,
} from "../src/lib/schedule";

export function scheduleTests() {
  describe("opening hours and time zones", () => {
    it("converts, validates and builds slots correctly across time zones and DST", () => {
      // Plain conversions
      assert.equal(zonedToUtc("2026-12-01", "15:00", "UTC").toISOString(), "2026-12-01T15:00:00.000Z");
      assert.equal(zonedToUtc("2026-12-01", "09:00", "Europe/Paris").toISOString(), "2026-12-01T08:00:00.000Z"); // winter +1
      assert.equal(zonedToUtc("2026-07-01", "09:00", "Europe/Paris").toISOString(), "2026-07-01T07:00:00.000Z"); // summer +2
      assert.equal(zonedToUtc("2026-07-01", "09:00", "America/New_York").toISOString(), "2026-07-01T13:00:00.000Z");
      assert.equal(zonedToUtc("2026-07-01", "09:30", "Asia/Kolkata").toISOString(), "2026-07-01T04:00:00.000Z"); // +5:30
      assert.equal(zonedToUtc("2026-07-01", "09:00", "Africa/Algiers").toISOString(), "2026-07-01T08:00:00.000Z"); // +1 no DST

      // DST transition days (Paris: 2026-03-29 02:00→03:00, 2026-10-25 03:00→02:00)
      assert.equal(zonedToUtc("2026-03-29", "09:00", "Europe/Paris").toISOString(), "2026-03-29T07:00:00.000Z");
      assert.equal(zonedToUtc("2026-10-25", "09:00", "Europe/Paris").toISOString(), "2026-10-25T08:00:00.000Z");

      // Round trip
      for (const tz of ["Europe/Paris", "America/Los_Angeles", "Australia/Sydney", "UTC"]) {
        for (const d of ["2026-01-15", "2026-03-29", "2026-06-15", "2026-10-25", "2026-11-01"]) {
          const t = zonedToUtc(d, "10:15", tz);
          const p = localParts(t, tz);
          assert.equal(p.date, d, `${tz} ${d}`);
          assert.equal(p.minutes, 10 * 60 + 15, `${tz} ${d}`);
        }
      }

      assert.equal(weekdayOf("2026-11-06"), "fri");
      assert.equal(weekdayOf("2026-11-09"), "mon");

      const hours = { mon: [{ open: "09:00", close: "12:00" }, { open: "14:00", close: "18:00" }] };
      const tz = "Europe/Paris";
      const mon = "2026-11-09";
      const at = (time: string) => zonedToUtc(mon, time, tz);
      const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

      assert.equal(withinOpeningHours(hours, tz, at("09:00"), plus(at("09:00"), 60)), true);
      assert.equal(withinOpeningHours(hours, tz, at("11:30"), plus(at("11:30"), 30)), true, "ends exactly at close");
      assert.equal(withinOpeningHours(hours, tz, at("11:30"), plus(at("11:30"), 60)), false, "runs into lunch");
      assert.equal(withinOpeningHours(hours, tz, at("08:59"), plus(at("08:59"), 30)), false);
      assert.equal(withinOpeningHours(hours, tz, zonedToUtc("2026-11-10", "10:00", tz), plus(zonedToUtc("2026-11-10", "10:00", tz), 30)), false, "closed tuesday");

      const slots = slotsForDate({
        hours, tz, date: mon, durationMinutes: 60, stepMinutes: 30,
        busy: [{ start: at("15:00"), end: at("16:00") }],
        notBefore: new Date("2026-11-01T00:00:00Z"),
      });
      const labels = slots.map((s) => {
        const p = localParts(s, tz);
        return `${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
      });
      assert.deepEqual(labels, ["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "16:00", "16:30", "17:00"]);

      const past = slotsForDate({ hours, tz, date: mon, durationMinutes: 60, stepMinutes: 30, busy: [], notBefore: at("10:00") });
      assert.equal(localParts(past[0], tz).minutes, 10 * 60 + 30, "slots at or before 'now' are dropped");

      // Spring-forward day in New York: 02:00–03:00 doesn't exist.
      const nySlots = slotsForDate({
        hours: { sun: [{ open: "01:00", close: "04:00" }] }, tz: "America/New_York", date: "2026-03-08",
        durationMinutes: 30, stepMinutes: 30, busy: [], notBefore: new Date(0),
      });
      const nyLabels = nySlots.map((s) => localParts(s, "America/New_York").minutes / 60);
      assert.ok(!nyLabels.includes(2) && !nyLabels.includes(2.5), `no slots in the skipped hour: ${nyLabels}`);


    });
  });
}
