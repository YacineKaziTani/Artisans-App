import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewApi, type ReviewPayload } from "@/api/review.api";
import { shopKeys } from "@/hooks/useShops";

export const reviewKeys = {
  byShop: (shopId: string) => ["reviews", "shop", shopId] as const,
  byProduct: (productId: string) => ["reviews", "product", productId] as const,
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
    qc.invalidateQueries({ queryKey: ["reviews", "product"] });
    qc.invalidateQueries({ queryKey: shopKeys.detail(shopId) });
  };
}

/** Creates the review, then uploads any photos to it. */
export function useCreateReview(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: async ({ photos = [], ...payload }: ReviewPayload & { photos?: File[] }) => {
      let review = await reviewApi.create(shopId, payload);
      for (const file of photos) review = await reviewApi.addPhoto(review.id, file);
      return review;
    },
    // Even if a photo failed, the review itself exists — show it.
    onSettled: invalidate,
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

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.byProduct(productId ?? ""),
    queryFn: () => reviewApi.listByProduct(productId!),
    enabled: Boolean(productId),
  });
}

export function useAddReviewPhoto(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => reviewApi.addPhoto(id, file),
    onSuccess: invalidate,
  });
}

export function useRemoveReviewPhoto(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: ({ id, index }: { id: string; index: number }) => reviewApi.removePhoto(id, index),
    onSuccess: invalidate,
  });
}

export function useReplyToReview(shopId: string) {
  const invalidate = useInvalidateShopReviews(shopId);
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => reviewApi.reply(id, reply),
    onSuccess: invalidate,
  });
}
