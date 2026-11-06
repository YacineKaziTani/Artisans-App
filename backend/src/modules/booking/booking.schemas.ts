import { z } from "zod";
import { optionalText, uuid } from "../../lib/schemas";
import { BookingStatus } from "./booking.entities";

export const createBookingSchema = z.object({
  serviceId: uuid("Service"),
  scheduledAt: z.iso
    .datetime({ offset: true, error: "Choose a valid date and time" })
    .transform((value) => new Date(value)),
  notes: optionalText("Notes", 1000),
});

export const bookingStatusSchema = z.object({
  status: z.enum(BookingStatus, { error: "Invalid status" }),
});
