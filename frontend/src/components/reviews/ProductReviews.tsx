import { useProductReviews } from "@/hooks/useReviews";
import { ReviewCard, Stars } from "./ReviewCard";

/** Reviews clients tagged with this product (read-only; written on the shop page). */
export function ProductReviews({ productId, shopName }: { productId: string; shopName?: string }) {
  const { data: reviews, isLoading, isError } = useProductReviews(productId);
  if (isLoading || isError || !reviews?.length) return null;

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return (
    <section className="mt-14" aria-labelledby="product-reviews-title">
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <h2 id="product-reviews-title" className="font-display text-2xl font-semibold">
          Reviews of this product
        </h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stars rating={average} /> {average.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} shopName={shopName} showProduct={false} />
        ))}
      </div>
    </section>
  );
}
