import { Link } from "react-router";
import { img } from "@/lib/images";
import type { Review } from "@/types";

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-muted-foreground/50">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

/**
 * One review: author, stars, what it's about, the text, photos and the
 * artisan's reply. `actions` (edit/report) and `footer` (reply form) are
 * slots for the shop page.
 */
export function ReviewCard({
  review,
  shopName,
  showProduct = true,
  actions,
  footer,
}: {
  review: Review;
  shopName?: string;
  showProduct?: boolean;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <article className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-semibold text-foreground">{review.author?.name ?? "Anonymous"}</p>
          <div className="flex flex-wrap items-center gap-x-2">
            <Stars rating={review.rating} />
            <span className="text-xs text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {actions}
      </div>

      {showProduct && review.product && (
        <p className="mt-2 text-xs text-muted-foreground">
          About{" "}
          <Link to={`/product/${review.product.id}`} className="font-medium text-primary hover:underline">
            {review.product.title}
          </Link>
        </p>
      )}

      {review.comment && <p className="text-foreground/80 text-sm mt-2 whitespace-pre-line">{review.comment}</p>}

      {(review.photos?.length ?? 0) > 0 && (
        <div className="mt-3 flex gap-2">
          {review.photos!.map((photo, i) => (
            <a key={photo.publicId} href={photo.url} target="_blank" rel="noopener noreferrer">
              <img
                {...img(photo.url, 96)}
                alt={`Photo ${i + 1} from ${review.author?.name ?? "the reviewer"}`}
                loading="lazy"
                className="size-24 rounded-lg border border-border object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {review.reply && (
        <div className="mt-3 rounded-lg border-l-2 border-primary/50 bg-muted/50 px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-foreground">
            Reply from {shopName ?? "the artisan"}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-foreground/80">{review.reply}</p>
        </div>
      )}

      {footer}
    </article>
  );
}
