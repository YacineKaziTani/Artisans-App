import { Link } from "react-router";
import { BadgeCheck, MapPin, Store } from "lucide-react";
import { RatingChip } from "@/components/Stars";
import { img } from "@/lib/images";
import type { Shop } from "@/types";

/** Shop logo, or its initial on a brand tile when there's no logo. */
export function ShopLogo({ shop, className = "size-14" }: { shop: Pick<Shop, "shopName" | "logoUrl">; className?: string }) {
  return shop.logoUrl ? (
    <img {...img(shop.logoUrl, 112)} alt="" className={`shrink-0 rounded-2xl object-cover ${className}`} />
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-display text-xl font-semibold text-brand-700 ${className}`}
      aria-hidden="true"
    >
      {shop.shopName.trim()[0]?.toUpperCase() ?? <Store className="size-5" />}
    </span>
  );
}

/** Artisan card with cover strip, logo, rating and location (home page, listings). */
export function ShopCard({ shop, className = "" }: { shop: Shop; className?: string }) {
  const cover = shop.coverUrl ?? shop.photos?.[0]?.url ?? null;
  return (
    <Link to={`/artisan/${shop.id}`} className={`surface-lift group flex flex-col overflow-hidden ${className}`}>
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand-100 via-secondary to-jade-50">
        {cover && (
          <img
            {...img(cover, 480)}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <ShopLogo shop={shop} className="-mt-8 size-16 border-4 border-card shadow-[var(--shadow-sm)]" />
        <div className="mt-3 flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 font-display text-lg font-semibold">
            <span className="truncate">{shop.shopName}</span>
            {shop.verificationStatus === "verified" && (
              <BadgeCheck className="size-4 shrink-0 text-info" aria-label="Verified shop" />
            )}
          </h3>
          <RatingChip rating={shop.averageRating} className="shrink-0" />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {shop.category?.name}
          {shop.city && (
            <span className="inline-flex items-center gap-0.5">
              {shop.category?.name ? " · " : ""}
              <MapPin className="size-3" aria-hidden="true" /> {shop.city}
            </span>
          )}
        </p>
        {shop.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{shop.description}</p>
        )}
      </div>
    </Link>
  );
}
