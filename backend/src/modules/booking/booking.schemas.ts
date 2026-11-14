import { z } from "zod";
import { int, optionalText, uuid } from "../../lib/schemas";
import { BookingStatus } from "./booking.entities";

export const createBookingSchema = z.object({
  serviceId: uuid("Service"),
  scheduledAt: z.iso
    .datetime({ offset: true, error: "Choose a valid date and time" })
    .transform((value) => new Date(value)),
  notes: optionalText("Notes", 1000),
  // Places in a class/workshop (private appointments are always 1).
  seats: int("Places", 1, 100).optional(),
});

export const bookingStatusSchema = z.object({
  status: z.enum(BookingStatus, { error: "Invalid status" }),
});
