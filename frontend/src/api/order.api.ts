import { api } from "@/lib/axios";
import type {
  DeliveryMethod,
  Order,
  OrderStatus,
  Page,
  PageParams,
} from "@/types";

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

export interface OrderListParams extends PageParams {
  status?: OrderStatus;
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

  mine: (params: OrderListParams = {}) =>
    api.get<Page<Order>>("/orders/mine", { params }).then((r) => r.data),

  shopOrders: (params: OrderListParams = {}) =>
    api.get<Page<Order>>("/orders/shop", { params }).then((r) => r.data),

  listAllAdmin: (params: OrderListParams = {}) =>
    api.get<Page<Order>>("/orders/admin/all", { params }).then((r) => r.data),

  updateStatus: (id: string, status: OrderStatus, trackingInfo?: string) =>
    api
      .patch<Order>(`/orders/${id}/status`, { status, trackingInfo })
      .then((r) => r.data),

  cancelMine: (id: string) =>
    api.patch<Order>(`/orders/${id}/cancel`).then((r) => r.data),

  /** The client confirms a delivery order arrived. */
  confirmReceived: (id: string) =>
    api.patch<Order>(`/orders/${id}/received`).then((r) => r.data),

  /** Back out of an unpaid checkout: releases its reserved stock now. */
  abandon: (orderIds: string[]) =>
    api
      .post<{ discarded: number }>("/orders/abandon", { orderIds })
      .then((r) => r.data),
};
