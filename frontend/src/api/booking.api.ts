import { api } from "@/lib/axios";
import type { Booking, BookingStatus } from "@/types";

export interface CreateBookingPayload {
  serviceId: string;
  scheduledAt: string;
  notes?: string;
}

export interface CreateBookingResult {
  booking: Booking;
  clientSecret: string;
}

export const bookingApi = {
  create: (payload: CreateBookingPayload) =>
    api
      .post<CreateBookingResult>("/bookings", payload)
      .then((r) => r.data),

  mine: () => api.get<Booking[]>("/bookings/mine").then((r) => r.data),

  shopBookings: () =>
    api.get<Booking[]>("/bookings/shop").then((r) => r.data),

  updateStatus: (id: string, status: BookingStatus) =>
    api
      .patch<Booking>(`/bookings/${id}/status`, { status })
      .then((r) => r.data),

  cancelMine: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/cancel`).then((r) => r.data),

  listAllAdmin: () =>
    api.get<Booking[]>("/bookings/admin/all").then((r) => r.data),
};
