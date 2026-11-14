import { Link } from "react-router";
import { Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginLink } from "@/components/LoginLink";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Price } from "@/components/Price";
import { onSale } from "@/lib/pricing";
import { useAddToCart } from "@/hooks/useAddToCart";
import { useAuthStore } from "@/store/auth.store";
import { shopCanAcceptPayments } from "@/lib/stripe";
import { img } from "@/lib/images";
import type { Product } from "@/types";

/** Card-sized placeholder while a list loads. */
export function ProductCardSkeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-80 ${className}`} />;
}

/**
 * The one product card: photo, sale tag, favourite heart, title, shop,
 * price and (optionally) an add-to-cart button. Used on the product
 * listings, shop pages, home page rows and "you may also like".
 */
export function ProductCard({
  product,
  favorited = false,
  showActions = true,
  showDescription = false,
  className = "",
}: {
  product: Product;
  favorited?: boolean;
  showActions?: boolean;
  showDescription?: boolean;
  className?: string;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const addToCart = useAddToCart();
  const shop = product.shop;
  const isOwn = Boolean(userId && shop?.owner?.id === userId);
  const hasOptions = Boolean(product.variantOptions?.length);
  const soldOut = !hasOptions && product.stockQuantity === 0;
  const lowStock =
    !hasOptions && product.stockQuantity != null && product.stockQuantity > 0 && product.stockQuantity <= 3;

  return (
    <div className={`surface-lift group relative flex flex-col overflow-hidden ${className}`}>
      {isAuthenticated && !isOwn && (
        <div className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-card/90 shadow-[var(--shadow-sm)] backdrop-blur">
          <FavoriteButton targetType="product" targetId={product.id} isFavorited={favorited} />
        </div>
      )}
      {onSale(product.basePrice, product.compareAtPrice) && (
        <span className="absolute top-3 left-3 z-10 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-white shadow-[var(--shadow-sm)]">
          Sale
        </span>
      )}

      {/* The title below is the accessible link; this one is for pointers. */}
      <Link to={`/product/${product.id}`} className="block overflow-hidden" tabIndex={-1} aria-hidden="true">
        {product.imageUrl ? (
          <img
            {...img(product.imageUrl, 480)}
            alt=""
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-brand-50 text-brand-500">
            <Package className="size-9" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link
          to={`/product/${product.id}`}
          className="line-clamp-2 font-display text-base font-semibold hover:text-primary sm:text-lg"
        >
          {product.title}
        </Link>
        {shop && (
          <Link to={`/artisan/${shop.id}`} className="mt-0.5 truncate text-xs text-muted-foreground hover:text-primary">
            {shop.shopName}
          </Link>
        )}
        {showDescription && product.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Price amount={product.basePrice} compareAt={product.compareAtPrice} />
          {soldOut ? (
            <span className="text-xs font-medium text-destructive">Sold out</span>
          ) : lowStock ? (
            <span className="text-xs font-medium text-warning">Only {product.stockQuantity} left</span>
          ) : null}
        </div>

        {showActions && (
          <div className="mt-auto pt-4">
            {!isAuthenticated ? (
              <Button asChild variant="outline" className="w-full">
                <LoginLink>Log in to buy</LoginLink>
              </Button>
            ) : isOwn ? (
              <Button asChild variant="outline" className="w-full">
                <Link to="/profile-artisan?tab=products">Your product — manage</Link>
              </Button>
            ) : !shop || !shopCanAcceptPayments(shop) ? (
              <Button variant="outline" className="w-full" disabled>
                Not available yet
              </Button>
            ) : hasOptions ? (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/product/${product.id}`}>Choose options</Link>
              </Button>
            ) : (
              <Button className="w-full" disabled={soldOut} onClick={() => addToCart(product)}>
                <ShoppingBag className="size-4" /> {soldOut ? "Sold out" : "Add to cart"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
