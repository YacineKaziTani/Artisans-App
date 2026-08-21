import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderApi } from "@/api/order.api";
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
    mutationFn: (items: { productId: string; quantity: number }[]) =>
      orderApi.checkout(items),
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
    queryFn: orderApi.listAllAdmin,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      orderApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.shop() });
    },
  });
}

export function useCancelMyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderApi.cancelMine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.mine() });
    },
  });
}
