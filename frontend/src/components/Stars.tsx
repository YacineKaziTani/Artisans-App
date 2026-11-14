import { Star } from "lucide-react";

/** Read-only star rating (rounded to the nearest half star). */
export function Stars({
  rating,
  size = "size-4",
  className = "",
}: {
  rating: number;
  /** Tailwind size class for each star. */
  size?: string;
  className?: string;
}) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? "full" : rounded >= n - 0.5 ? "half" : "empty";
        return (
          <span key={n} className={`relative inline-block ${size}`} aria-hidden="true">
            <Star className={`absolute inset-0 ${size} text-muted-foreground/35`} />
            {fill !== "empty" && (
              <span className={`absolute inset-0 overflow-hidden ${fill === "half" ? "w-1/2" : "w-full"}`}>
                <Star className={`${size} fill-star text-star`} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** "★ 4.8 (23)" chip for cards and headers. */
export function RatingChip({ rating, count, className = "" }: { rating: number; count?: number; className?: string }) {
  if (!rating) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${className}`}>
      <Star className="size-4 fill-star text-star" aria-hidden="true" />
      {rating.toFixed(1)}
      {count !== undefined && <span className="font-normal text-muted-foreground">({count})</span>}
      <span className="sr-only">out of 5 stars</span>
    </span>
  );
}
