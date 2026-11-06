import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewApi, type ReviewPayload } from "@/api/review.api";
import { shopKeys } from "@/hooks/useShops";

export const reviewKeys = {
  byShop: (shopId: string) => ["reviews", "shop", shopId] as const,
  eligibility: (shopId: string) =>
    ["reviews", "shop", shopId, "eligibility"] as const,
};

export function useShopReviews(shopId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.byShop(shopId ?? ""),
    queryFn: () => reviewApi.listByShop(shopId!),
    enabled: Boolean(shopId),
  });
}

/** Whether the signed-in user may review this shop (and why not). */
export function useReviewEligibility(
  shopId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: reviewKeys.eligibility(shopId ?? ""),
    queryFn: () => reviewApi.eligibility(shopId!),
    enabled: Boolean(shopId) && (options.enabled ?? true),
  });
}

function useInvalidateShopReviews(shopId: string) {
  const qc = useQueryClient();
  return () => {
    // Prefix match also refreshes the eligibility query.
    qc.invalidateQueries({ queryKey: reviewKeys.byShop(shopId) });
    qc.invalidateQueries({ queryKey: shopKeys.detail(shopId) });
  };
}

export function useCreateReview(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: (payload: ReviewPayload) => reviewApi.create(shopId, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateReview(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ReviewPayload> }) =>
      reviewApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteReview(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: (id: string) => reviewApi.remove(id),
    onSuccess: invalidate,
  });
}
