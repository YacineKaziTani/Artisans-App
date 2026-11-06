import { api } from "@/lib/axios";
import type { PaginatedShops, Shop, ShopStats } from "@/types";

export interface ListShopsParams {
  category?: string;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export type ShopDetailsPayload = Partial<{
  shopName: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  categoryId: string;
}>;

/** JSON normally; multipart when there's an image to upload (the API takes either). */
function withOptionalImage(fields: Record<string, string | undefined>, image?: File | null) {
  if (!image) return fields;
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  form.append("image", image);
  return form;
}

export const shopApi = {
  list: (params: ListShopsParams = {}) =>
    api
      .get<PaginatedShops>("/shops", { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<Shop>(`/shops/${id}`).then((r) => r.data),

  getMine: () => api.get<Shop>("/shops/mine").then((r) => r.data),

  /** Empty strings clear a field. Pass `logo` to replace the shop logo. */
  updateMine: ({ logo, ...payload }: ShopDetailsPayload & { logo?: File | null }) =>
    api
      .put<{ message: string; shop: Shop }>("/shops/mine", withOptionalImage(payload, logo))
      .then((r) => r.data.shop),

  create: ({
    logo,
    ...payload
  }: ShopDetailsPayload & { shopName: string; categoryId: string; logo?: File | null }) =>
    api
      .post<{ message: string; shop: Shop }>("/shops/create", withOptionalImage(payload, logo))
      .then((r) => r.data.shop),

  closeMine: () =>
    api
      .patch<{ message: string; shop: Shop }>("/shops/mine/close")
      .then((r) => r.data.shop),

  reopenMine: () =>
    api
      .patch<{ message: string; shop: Shop }>("/shops/mine/reopen")
      .then((r) => r.data.shop),

  listAllAdmin: (params: { status?: string; page?: number; limit?: number } = {}) =>
    api.get<PaginatedShops>("/shops/admin/all", { params }).then((r) => r.data),

  updateStatusAdmin: (id: string, status: Shop["status"]) =>
    api
      .patch<{ message: string; shop: Shop }>(`/shops/${id}/status`, { status })
      .then((r) => r.data.shop),

  requestVerification: () =>
    api
      .patch<{ message: string; shop: Shop }>("/shops/mine/request-verification")
      .then((r) => r.data.shop),

  resolveVerification: (
    id: string,
    status: "verified" | "rejected",
    note?: string,
  ) =>
    api
      .patch<{ message: string; shop: Shop }>(`/shops/${id}/verification`, {
        status,
        note,
      })
      .then((r) => r.data.shop),

  connectStripe: () =>
    api.post<{ url: string }>("/shops/mine/connect-stripe").then((r) => r.data),

  getStripeStatus: () =>
    api
      .get<{ connected: boolean; onboardingComplete: boolean; detailsSubmitted?: boolean }>(
        "/shops/mine/stripe-status",
      )
      .then((r) => r.data),

  /** Artisan dashboard numbers. */
  getMyStats: () => api.get<ShopStats>("/shops/mine/stats").then((r) => r.data),

  /** Admin preview of a shop in any status (pending shops aren't public). */
  getAdminPreview: (id: string) =>
    api
      .get<Shop & { productCount: number }>(`/shops/admin/${id}`)
      .then((r) => r.data),
};
