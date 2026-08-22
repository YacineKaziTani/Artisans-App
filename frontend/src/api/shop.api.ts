import { api } from "@/lib/axios";
import type { PaginatedShops, Shop } from "@/types";

export interface ListShopsParams {
  category?: string;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const shopApi = {
  list: (params: ListShopsParams = {}) =>
    api
      .get<PaginatedShops>("/shops", { params })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<Shop>(`/shops/${id}`).then((r) => r.data),

  getMine: () => api.get<Shop>("/shops/mine").then((r) => r.data),

  updateMine: (payload: Partial<{
    shopName: string;
    description: string;
    address: string;
    city: string;
    phone: string;
    categoryId: string;
  }>) =>
    api
      .put<{ message: string; shop: Shop }>("/shops/mine", payload)
      .then((r) => r.data.shop),

  create: (payload: {
    shopName: string;
    description?: string;
    address?: string;
    city?: string;
    phone?: string;
    categoryId: string;
  }) =>
    api
      .post<{ message: string; shop: Shop }>("/shops/create", payload)
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
};
