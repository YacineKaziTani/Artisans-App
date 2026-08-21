import { api } from "@/lib/axios";
import type { Order, OrderStatus } from "@/types";

export interface CreateOrderPayload {
  productId: string;
  quantity: number;
}

export interface CreateOrderResult {
  order: Order;
  clientSecret: string;
}

export const orderApi = {
  create: (payload: CreateOrderPayload) =>
    api.post<CreateOrderResult>("/orders", payload).then((r) => r.data),

  checkout: (items: { productId: string; quantity: number }[]) =>
    api
      .post<{ orders: Order[]; clientSecret: string }>("/orders/checkout", {
        items,
      })
      .then((r) => r.data),

  mine: () => api.get<Order[]>("/orders/mine").then((r) => r.data),

  shopOrders: () => api.get<Order[]>("/orders/shop").then((r) => r.data),

  listAllAdmin: () => api.get<Order[]>("/orders/admin/all").then((r) => r.data),

  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then((r) => r.data),

  cancelMine: (id: string) =>
    api.patch<Order>(`/orders/${id}/cancel`).then((r) => r.data),
};
