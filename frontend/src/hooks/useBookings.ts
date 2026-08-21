import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "@/api/booking.api";
import type { BookingStatus } from "@/types";

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
      qc.invalidateQueries({ queryKey: bookingKeys.mine() });
    },
  });
}

export function useMyBookings() {
  return useQuery({
    queryKey: bookingKeys.mine(),
    queryFn: bookingApi.mine,
  });
}

export function useShopBookings() {
  return useQuery({
    queryKey: bookingKeys.shop(),
    queryFn: bookingApi.shopBookings,
  });
}

export function useAdminBookings() {
  return useQuery({
    queryKey: [...bookingKeys.all, "admin"] as const,
    queryFn: bookingApi.listAllAdmin,
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      bookingApi.updateStatus(id, status),
    onSuccess: () => {
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
