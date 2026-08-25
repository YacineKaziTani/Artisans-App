import { api } from "@/lib/axios";
import type { DeliveryMethod, Order, OrderStatus } from "@/types";

export interface DeliveryInfo {
  deliveryMethod: DeliveryMethod;
  shippingAddress?: string;
}

export interface CreateOrderPayload extends DeliveryInfo {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CreateOrderResult {
  order: Order;
  clientSecret: string;
}

export const orderApi = {
  create: (payload: CreateOrderPayload) =>
    api.post<CreateOrderResult>("/orders", payload).then((r) => r.data),

  checkout: (
    items: { productId: string; variantId?: string; quantity: number }[],
    delivery: DeliveryInfo,
  ) =>
    api
      .post<{ orders: Order[]; clientSecret: string }>("/orders/checkout", {
        items,
        ...delivery,
      })
      .then((r) => r.data),

  mine: () => api.get<Order[]>("/orders/mine").then((r) => r.data),

  shopOrders: () => api.get<Order[]>("/orders/shop").then((r) => r.data),

  listAllAdmin: () => api.get<Order[]>("/orders/admin/all").then((r) => r.data),

  updateStatus: (id: string, status: OrderStatus, trackingInfo?: string) =>
    api
      .patch<Order>(`/orders/${id}/status`, { status, trackingInfo })
      .then((r) => r.data),

  cancelMine: (id: string) =>
    api.patch<Order>(`/orders/${id}/cancel`).then((r) => r.data),
};
