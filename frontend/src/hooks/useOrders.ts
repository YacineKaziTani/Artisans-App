import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  orderApi,
  type DeliveryInfo,
  type OrderListParams,
} from "@/api/order.api";
import type { OrderStatus } from "@/types";
import { track } from "@/lib/analytics";

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
      track("Checkout started", { kind: "order" });
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
      track("Checkout started", { kind: "cart" });
      qc.invalidateQueries({ queryKey: orderKeys.mine() });
    },
  });
}

// Paginated lists keep showing the current page while the next one loads.

export function useMyOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: [...orderKeys.mine(), params],
    queryFn: () => orderApi.mine(params),
    placeholderData: keepPreviousData,
  });
}

export function useShopOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: [...orderKeys.shop(), params],
    queryFn: () => orderApi.shopOrders(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrders(params: OrderListParams = {}) {
  return useQuery({
    queryKey: [...orderKeys.admin(), params],
    queryFn: () => orderApi.listAllAdmin(params),
    placeholderData: keepPreviousData,
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

export function useConfirmReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderApi.confirmReceived(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
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

/**
 * Releases the stock held by a checkout the client didn't pay for. Callers
 * fire it when the payment step is dismissed; if it fails (offline, etc.)
 * the server's expiry sweep releases the stock later anyway.
 */
export function useAbandonCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => orderApi.abandon(orderIds),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
    },
  });
}
