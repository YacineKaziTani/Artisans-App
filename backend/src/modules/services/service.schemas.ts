import { z } from "zod";
import {
  clearableInt,
  int,
  money,
  optionalBoolean,
  optionalMoney,
  optionalText,
  requiredText,
} from "../../lib/schemas";

// $0.50 is Stripe's minimum card charge, so a cheaper service could never
// actually be booked.
const PRICE = { min: 0.5 };
const DURATION_MINUTES: [number, number] = [5, 24 * 60];

export const createServiceSchema = z.object({
  name: requiredText("Name", 120),
  description: optionalText("Description", 2000),
  price: money("Price", PRICE),
  duration: optionalText("Duration", 60),
  durationMinutes: clearableInt("Appointment length", ...DURATION_MINUTES),
  // 1 = private appointment; more = a class with that many places.
  capacity: int("Places per session", 1, 100).optional(),
});

export const updateServiceSchema = z.object({
  name: requiredText("Name", 120).optional(),
  description: optionalText("Description", 2000),
  price: optionalMoney("Price", PRICE),
  duration: optionalText("Duration", 60),
  durationMinutes: clearableInt("Appointment length", ...DURATION_MINUTES),
  capacity: int("Places per session", 1, 100).optional(),
  isAvailable: optionalBoolean("isAvailable"),
});
