import { api } from "@/lib/axios";
import type { Product, ProductImage } from "@/types";

export interface ListProductsParams {
  shopId?: string;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}

export const productApi = {
  listAll: (params: ListProductsParams = {}) =>
    api.get<Product[]>("/products", { params }).then((r) => r.data),

  mine: () => api.get<Product[]>("/products/mine").then((r) => r.data),

  create: (payload: FormData) =>
    api
      .post<Product>("/products", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  update: (
    id: string,
    payload: Partial<{ title: string; description: string; basePrice: number }>,
  ) => api.put<Product>(`/products/${id}`, payload).then((r) => r.data),

  remove: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),

  addImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api
      .post<ProductImage>(`/products/${id}/images`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  removeImage: (imageId: string) =>
    api.delete(`/products/images/${imageId}`).then((r) => r.data),
};
