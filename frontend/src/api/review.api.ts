import { api } from "@/lib/axios";
import type { Review, ReviewEligibility, ReviewHighlight } from "@/types";

export interface ReviewPayload {
  rating: number;
  comment?: string;
  /** A product the client received from this shop; null clears it (edit). */
  productId?: string | null;
}

export const reviewApi = {
  highlights: (limit = 6) =>
    api.get<ReviewHighlight[]>("/reviews/highlights", { params: { limit } }).then((r) => r.data),

  listByShop: (shopId: string) =>
    api.get<Review[]>(`/reviews/shop/${shopId}`).then((r) => r.data),

  /** Reviews tagged with this product. */
  listByProduct: (productId: string) =>
    api.get<Review[]>(`/reviews/product/${productId}`).then((r) => r.data),

  eligibility: (shopId: string) =>
    api
      .get<ReviewEligibility>(`/reviews/shop/${shopId}/eligibility`)
      .then((r) => r.data),

  create: (shopId: string, payload: ReviewPayload) =>
    api.post<Review>(`/reviews/shop/${shopId}`, payload).then((r) => r.data),

  update: (id: string, payload: Partial<ReviewPayload>) =>
    api.patch<Review>(`/reviews/${id}`, payload).then((r) => r.data),

  remove: (id: string) => api.delete(`/reviews/${id}`).then((r) => r.data),

  addPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.post<Review>(`/reviews/${id}/photos`, form).then((r) => r.data);
  },

  removePhoto: (id: string, index: number) =>
    api.delete<Review>(`/reviews/${id}/photos/${index}`).then((r) => r.data),

  /** The shop owner's reply; an empty string removes it. */
  reply: (id: string, reply: string) =>
    api.put<Review>(`/reviews/${id}/reply`, { reply }).then((r) => r.data),
};
