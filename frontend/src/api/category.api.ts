import { api } from "@/lib/axios";
import type { Category } from "@/types";

export interface CategoryPayload {
  name: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export const categoryApi = {
  list: () =>
    api
      .get<{ msg: string; category: Category[] }>("/categories")
      .then((r) => r.data.category),

  listAllAdmin: () =>
    api.get<Category[]>("/categories/admin/all").then((r) => r.data),

  create: (payload: CategoryPayload) =>
    api
      .post<{ message: string; data: Category }>("/categories/create", payload)
      .then((r) => r.data.data),

  update: (id: string, payload: Partial<CategoryPayload>) =>
    api
      .put<{ message: string; data: Category }>(`/categories/${id}`, payload)
      .then((r) => r.data.data),

  remove: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
};
