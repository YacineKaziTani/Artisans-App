import { api } from "@/lib/axios";
import type { Review } from "@/types";

export interface ReviewPayload {
  rating: number;
  comment?: string;
}

export const reviewApi = {
  listByShop: (shopId: string) =>
    api.get<Review[]>(`/reviews/shop/${shopId}`).then((r) => r.data),

  create: (shopId: string, payload: ReviewPayload) =>
    api.post<Review>(`/reviews/shop/${shopId}`, payload).then((r) => r.data),

  update: (id: string, payload: Partial<ReviewPayload>) =>
    api.patch<Review>(`/reviews/${id}`, payload).then((r) => r.data),

  remove: (id: string) => api.delete(`/reviews/${id}`).then((r) => r.data),
};
