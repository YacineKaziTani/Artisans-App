import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderApi, type DeliveryInfo } from "@/api/order.api";
import type { OrderStatus } from "@/types";

export const orderKeys = {
  all: ["orders"] as const,
  mine: () => [...orderKeys.all, "mine"] as const,
  shop: () => [...orderKeys.all, "shop"] as const,
  admin: () => [...orderKeys.all, "admin"] as const,
};

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orderApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.mine() });
    },
  });
}

export function useCartCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      items,
      delivery,
    }: {
      items: { productId: string; variantId?: string; quantity: number }[];
      delivery: DeliveryInfo;
    }) => orderApi.checkout(items, delivery),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.mine() });
    },
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: orderKeys.mine(),
    queryFn: orderApi.mine,
  });
}

export function useShopOrders() {
  return useQuery({
    queryKey: orderKeys.shop(),
    queryFn: orderApi.shopOrders,
  });
}

export function useAdminOrders() {
  return useQuery({
    queryKey: orderKeys.admin(),
    queryFn: () => orderApi.listAllAdmin(),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      trackingInfo,
    }: {
      id: string;
      status: OrderStatus;
      trackingInfo?: string;
    }) => orderApi.updateStatus(id, status, trackingInfo),
    onSuccess: () => {
      // A cart order settles its siblings when the last line resolves, so
      // refresh the whole list rather than patching the single row.
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useCancelMyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderApi.cancelMine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}
