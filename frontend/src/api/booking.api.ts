import { api } from "@/lib/axios";
import type { Booking, BookingStatus, Page, PageParams } from "@/types";

export interface CreateBookingPayload {
  serviceId: string;
  scheduledAt: string;
  notes?: string;
}

export interface CreateBookingResult {
  booking: Booking;
  clientSecret: string;
}

export interface BookingListParams extends PageParams {
  status?: BookingStatus;
}

export const bookingApi = {
  create: (payload: CreateBookingPayload) =>
    api
      .post<CreateBookingResult>("/bookings", payload)
      .then((r) => r.data),

  mine: (params: BookingListParams = {}) =>
    api.get<Page<Booking>>("/bookings/mine", { params }).then((r) => r.data),

  shopBookings: (params: BookingListParams = {}) =>
    api.get<Page<Booking>>("/bookings/shop", { params }).then((r) => r.data),

  updateStatus: (id: string, status: BookingStatus) =>
    api
      .patch<Booking>(`/bookings/${id}/status`, { status })
      .then((r) => r.data),

  cancelMine: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/cancel`).then((r) => r.data),

  /** Back out of an unpaid booking checkout: frees its time slot now. */
  abandon: (id: string) =>
    api
      .post<{ discarded: boolean }>(`/bookings/${id}/abandon`)
      .then((r) => r.data),

  listAllAdmin: (params: BookingListParams = {}) =>
    api
      .get<Page<Booking>>("/bookings/admin/all", { params })
      .then((r) => r.data),
};
