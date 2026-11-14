import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import type { Product } from "@/types";

/**
 * A titled, swipeable row of product cards ("Trending this week", "More
 * from this shop", "You may also like"). Renders nothing when empty.
 */
export function ProductRow({
  title,
  eyebrow,
  products,
  isLoading = false,
  moreHref,
  moreLabel = "See all",
  favoriteIds = [],
  showActions = false,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  products: Product[] | undefined;
  isLoading?: boolean;
  moreHref?: string;
  moreLabel?: string;
  favoriteIds?: string[];
  showActions?: boolean;
  className?: string;
}) {
  if (!isLoading && (products ?? []).length === 0) return null;

  return (
    <section className={className} aria-label={title}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 className={`font-display text-2xl font-semibold sm:text-3xl ${eyebrow ? "mt-3" : ""}`}>{title}</h2>
        </div>
        {moreHref && (
          <Link
            to={moreHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {moreLabel} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="snap-row -mx-4 gap-4 px-4 pt-1 pb-3 sm:mx-0 sm:px-0">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} className="w-60 shrink-0 sm:w-64" />)
          : products!.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favorited={favoriteIds.includes(product.id)}
                showActions={showActions}
                className="w-60 shrink-0 sm:w-64"
              />
            ))}
      </div>
    </section>
  );
}
