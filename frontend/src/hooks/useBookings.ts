import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { bookingApi, type BookingListParams } from "@/api/booking.api";
import type { BookingStatus } from "@/types";
import { track } from "@/lib/analytics";
import { toast } from "@/lib/toast";

export const bookingKeys = {
  all: ["bookings"] as const,
  mine: () => [...bookingKeys.all, "mine"] as const,
  shop: () => [...bookingKeys.all, "shop"] as const,
};

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bookingApi.create,
    onSuccess: () => {
      track("Checkout started", { kind: "booking" });
      qc.invalidateQueries({ queryKey: bookingKeys.mine() });
    },
  });
}

// Paginated lists keep showing the current page while the next one loads.

export function useMyBookings(params: BookingListParams = {}) {
  return useQuery({
    queryKey: [...bookingKeys.mine(), params],
    queryFn: () => bookingApi.mine(params),
    placeholderData: keepPreviousData,
  });
}

export function useShopBookings(params: BookingListParams = {}) {
  return useQuery({
    queryKey: [...bookingKeys.shop(), params],
    queryFn: () => bookingApi.shopBookings(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminBookings(params: BookingListParams = {}) {
  return useQuery({
    queryKey: [...bookingKeys.all, "admin", params],
    queryFn: () => bookingApi.listAllAdmin(params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      bookingApi.updateStatus(id, status),
    onSuccess: (_data, { status }) => {
      toast.success(
        status === "confirmed" ? "Booking confirmed" : status === "completed" ? "Marked as completed" : "Booking cancelled",
      );
      qc.invalidateQueries({ queryKey: bookingKeys.shop() });
    },
  });
}

export function useCancelMyBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingApi.cancelMine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingKeys.mine() });
    },
  });
}

/**
 * Frees the time slot held by a booking the client didn't pay for. Fired
 * when the payment step is dismissed; the server's expiry sweep is the
 * fallback if this request never lands.
 */
export function useAbandonBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingApi.abandon(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bookingKeys.mine() });
    },
  });
}
