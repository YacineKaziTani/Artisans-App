import { api } from "@/lib/axios";
import type { Product } from "@/types";

export const productApi = {
  listAll: (shopId?: string) =>
    api
      .get<Product[]>("/products", { params: shopId ? { shopId } : {} })
      .then((r) => r.data),

  mine: () => api.get<Product[]>("/products/mine").then((r) => r.data),

  create: (payload: FormData) =>
    api
      .post<Product>("/products", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  update: (id: string, payload: FormData) =>
    api
      .put<Product>(`/products/${id}`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  remove: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
};
