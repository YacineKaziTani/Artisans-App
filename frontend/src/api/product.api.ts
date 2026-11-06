import { api } from "@/lib/axios";
import type { Page, PageParams, Product, ProductImage } from "@/types";

export type ProductSort = "newest" | "price_asc" | "price_desc";

export type ProductUpdatePayload = Partial<{
  title: string;
  description: string;
  basePrice: number;
  /** null = not tracked (made to order). */
  stockQuantity: number | null;
}>;

export interface ListProductsParams extends PageParams {
  shopId?: string;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

export const productApi = {
  listAll: (params: ListProductsParams = {}) =>
    api.get<Page<Product>>("/products", { params }).then((r) => r.data),

  /** Public product page: gallery, options, variants and the shop. */
  getById: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),

  mine: () => api.get<Product[]>("/products/mine").then((r) => r.data),

  create: (payload: FormData) =>
    api
      .post<Product>("/products", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  update: (id: string, payload: ProductUpdatePayload) =>
    api.put<Product>(`/products/${id}`, payload).then((r) => r.data),

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
