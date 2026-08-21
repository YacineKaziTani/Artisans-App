import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewApi, type ReviewPayload } from "@/api/review.api";
import { shopKeys } from "@/hooks/useShops";

export const reviewKeys = {
  byShop: (shopId: string) => ["reviews", "shop", shopId] as const,
};

export function useShopReviews(shopId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.byShop(shopId ?? ""),
    queryFn: () => reviewApi.listByShop(shopId!),
    enabled: Boolean(shopId),
  });
}

export function useCreateReview(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReviewPayload) => reviewApi.create(shopId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.byShop(shopId) });
      qc.invalidateQueries({ queryKey: shopKeys.detail(shopId) });
    },
  });
}

export function useDeleteReview(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.byShop(shopId) });
      qc.invalidateQueries({ queryKey: shopKeys.detail(shopId) });
    },
  });
}
