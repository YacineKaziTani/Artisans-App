import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  BadgeCheck,
  Flag,
  Maximize2,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginLink } from "@/components/LoginLink";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportDialog } from "@/components/ReportDialog";
import { BuyProductDialog } from "@/components/booking/BuyProductDialog";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { PageMeta } from "@/components/PageMeta";
import { Price } from "@/components/Price";
import { ProductRow } from "@/components/ProductRow";
import { Lightbox } from "@/components/Lightbox";
import { ShopLogo } from "@/components/ShopCard";
import { RatingChip } from "@/components/Stars";
import { useProduct, useProducts, useSimilarProducts } from "@/hooks/useProducts";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { useAddToCart } from "@/hooks/useAddToCart";
import { useAuthStore } from "@/store/auth.store";
import { useRecentlyViewed } from "@/store/recently-viewed.store";
import { shopCanAcceptPayments } from "@/lib/stripe";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney, variantUnitPrice } from "@/lib/pricing";
import { img } from "@/lib/images";
import type { Product } from "@/types";

/** Swipeable photos on phones, thumbnails on larger screens, tap to zoom. */
function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);

  const show = (index: number) => {
    setActive(index);
    const el = track.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-brand-50 text-brand-500">
        <Package className="size-12" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={track}
          className="snap-row rounded-3xl border border-border/70 bg-muted"
          onScroll={(e) => {
            const el = e.currentTarget;
            const index = Math.round(el.scrollLeft / el.clientWidth);
            if (index !== active) setActive(index);
          }}
        >
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightbox(index)}
              className="w-full shrink-0 cursor-zoom-in"
              aria-label={`Open photo ${index + 1} of ${images.length} full screen`}
            >
              <img
                {...img(url, 720)}
                alt={index === 0 ? title : ""}
                className="aspect-square w-full object-cover"
                fetchPriority={index === 0 ? "high" : undefined}
                loading={index === 0 ? undefined : "lazy"}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLightbox(active)}
          className="glass absolute right-3 bottom-3 rounded-full p-2.5 text-foreground shadow-[var(--shadow-sm)]"
          aria-label="View full screen"
        >
          <Maximize2 className="size-4" />
        </button>
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:hidden" aria-hidden="true">
            {images.map((url, index) => (
              <span
                key={url}
                className={`h-1.5 rounded-full transition-all ${index === active ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="hidden gap-2 sm:flex">
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => show(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === active}
              className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                index === active ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"
              }`}
            >
              <img {...img(url, 80)} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        images={images}
        index={lightbox}
        onIndexChange={(index) => {
          setLightbox(index);
          show(index);
        }}
        onClose={() => setLightbox(null)}
        alt={title}
      />
    </div>
  );
}

/**
 * A product's own page, so products can be linked to and shared — every
 * product link used to go to the whole shop page.
 */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError, error, refetch } = useProduct(id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const addToCart = useAddToCart();
  const { data: favoriteIds } = useFavoriteIds("product", { enabled: isAuthenticated });
  const { data: similar, isLoading: similarLoading } = useSimilarProducts(product?.id);
  const { data: fromShop } = useProducts(
    { shopId: product?.shop?.id, limit: 9 },
    { enabled: Boolean(product?.shop?.id) },
  );
  const recordView = useRecentlyViewed((s) => s.record);
  const recentlyViewed = useRecentlyViewed((s) => s.items);
  const [buying, setBuying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (product) recordView(product);
  }, [product, recordView]);

  if (isLoading) {
    return (
      <main className="page-shell py-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="skeleton aspect-square rounded-3xl" />
          <div className="space-y-4">
            <div className="skeleton h-10 w-2/3" />
            <div className="skeleton h-6 w-1/3" />
            <div className="skeleton h-32" />
          </div>
        </div>
      </main>
    );
  }

  if (isError || !product) {
    const notFound = !isError || (isAxiosError(error) && error.response?.status === 404);
    return (
      <main className="page-shell space-y-4 py-12">
        <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All products
        </Link>
        {notFound ? (
          <p className="alert-error">This product isn't available any more.</p>
        ) : (
          <>
            <p className="alert-error">{getErrorMessage(error, "Couldn't load this product.")}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </>
        )}
      </main>
    );
  }

  const shop = product.shop;
  const images = product.images?.length
    ? product.images.map((image) => image.url)
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  const hasVariants = Boolean(product.variantOptions?.length);
  const variants = product.variants ?? [];
  const prices = variants.map((variant) => variantUnitPrice(product, variant));
  const minPrice = hasVariants && prices.length ? Math.min(...prices) : Number(product.basePrice);
  const maxPrice = hasVariants && prices.length ? Math.max(...prices) : minPrice;
  const tracked = !hasVariants && product.stockQuantity !== null && product.stockQuantity !== undefined;
  const soldOut = hasVariants
    ? variants.length > 0 && variants.every((variant) => variant.stockQuantity < 1)
    : tracked && (product.stockQuantity ?? 0) < 1;
  const canPay = shop ? shopCanAcceptPayments(shop) : false;
  const isOwn = Boolean(user && shop?.owner && shop.owner.id === user.id);
  const canBuy = isAuthenticated && !isOwn && canPay && !soldOut;
  const moreFromShop = (fromShop?.data ?? []).filter((p) => p.id !== product.id).slice(0, 8);
  const others = (list: Product[] | undefined) => (list ?? []).filter((p) => p.id !== product.id);

  const priceLabel =
    minPrice === maxPrice ? null : `${formatMoney(minPrice)} – ${formatMoney(maxPrice)}`;

  const buyButtons = (size: "default" | "lg", className = "") => (
    <div className={`flex gap-2 ${className}`}>
      {!hasVariants && (
        <Button size={size} variant="outline" className="flex-1 sm:flex-none" disabled={!canBuy} onClick={() => addToCart(product)}>
          <ShoppingBag className="size-4" /> Add to cart
        </Button>
      )}
      <Button size={size} variant="gradient" className="flex-1 sm:flex-none" disabled={!canBuy} onClick={() => setBuying(true)}>
        {soldOut ? "Sold out" : hasVariants ? "Choose options" : "Buy now"}
      </Button>
    </div>
  );

  return (
    <main className="pb-28 md:pb-12">
      <PageMeta
        title={shop ? `${product.title} by ${shop.shopName}` : product.title}
        description={product.description || `${product.title} — handmade${shop ? ` by ${shop.shopName}` : ""}.`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          description: product.description || undefined,
          image: images.length ? images : undefined,
          brand: shop ? { "@type": "Brand", name: shop.shopName } : undefined,
          offers: {
            "@type": "Offer",
            price: minPrice.toFixed(2),
            priceCurrency: "USD",
            availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          },
        }}
      />

      <div className="page-shell py-6 sm:py-10">
        {shop && (
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/products" className="hover:text-foreground">
              Products
            </Link>
            <span aria-hidden="true">/</span>
            <Link to={`/artisan/${shop.id}`} className="hover:text-foreground">
              {shop.shopName}
            </Link>
          </nav>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
          <Gallery images={images} title={product.title} />

          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">{product.title}</h1>
                {isAuthenticated && !isOwn && (
                  <FavoriteButton
                    targetType="product"
                    targetId={product.id}
                    isFavorited={(favoriteIds ?? []).includes(product.id)}
                    className="mt-1"
                  />
                )}
              </div>
              {shop?.category?.name && <p className="mt-1 text-sm text-muted-foreground">{shop.category.name}</p>}
            </div>

            {priceLabel ? (
              <p className="font-display text-3xl font-semibold text-primary">{priceLabel}</p>
            ) : (
              <Price amount={minPrice} compareAt={hasVariants ? null : product.compareAtPrice} size="lg" />
            )}

            {soldOut ? (
              <p className="text-sm font-medium text-destructive">Sold out</p>
            ) : tracked ? (
              <p className={`text-sm font-medium ${(product.stockQuantity ?? 0) <= 3 ? "text-warning" : "text-success"}`}>
                {(product.stockQuantity ?? 0) <= 3 ? `Only ${product.stockQuantity} left` : `${product.stockQuantity} in stock`}
              </p>
            ) : hasVariants ? (
              <p className="text-sm text-muted-foreground">
                Available in {variants.length} option{variants.length === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Made to order</p>
            )}

            {isOwn ? (
              <p className="alert-info">
                This is your product — <Link to="/profile-artisan?tab=products" className="font-semibold underline">manage it from your shop</Link>.
              </p>
            ) : !isAuthenticated ? (
              <Button asChild size="lg" variant="gradient" className="w-full sm:w-auto">
                <LoginLink>Log in to buy</LoginLink>
              </Button>
            ) : !canPay ? (
              <p className="alert-note">This shop is still setting up payouts — check back soon.</p>
            ) : (
              buyButtons("lg", "hidden md:flex")
            )}

            <ul className="space-y-2.5 rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">Your card is only held at checkout.</strong> You're charged when the artisan
                  sends or hands over your order — if they can't, the hold is released.
                </span>
              </li>
              {shop && (shop.deliveryEnabled !== false || shop.pickupEnabled !== false) && (
                <li className="flex items-start gap-2.5">
                  <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    {[
                      shop.deliveryEnabled !== false &&
                        (Number(shop.deliveryFee ?? 0) > 0 ? `Delivery ${formatMoney(shop.deliveryFee ?? 0)}` : "Free delivery"),
                      shop.pickupEnabled !== false && `pickup${shop.city ? ` in ${shop.city}` : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" or ")}
                    {shop.freeDeliveryOver ? ` · free delivery over ${formatMoney(shop.freeDeliveryOver)}` : ""}
                  </span>
                </li>
              )}
            </ul>

            {product.description && (
              <section>
                <h2 className="text-lg font-semibold">About this piece</h2>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-foreground/80">{product.description}</p>
              </section>
            )}

            {shop && (
              <Link to={`/artisan/${shop.id}`} className="surface-lift flex items-center gap-4 p-4">
                <ShopLogo shop={shop} className="size-14" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Made by</p>
                  <p className="flex items-center gap-1.5 truncate font-display text-lg font-semibold">
                    {shop.shopName}
                    {shop.verificationStatus === "verified" && (
                      <BadgeCheck className="size-4 shrink-0 text-info" aria-label="Verified shop" />
                    )}
                  </p>
                  <RatingChip rating={shop.averageRating} className="text-xs" />
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                  <Store className="size-4" /> Visit shop
                </span>
              </Link>
            )}

            {isAuthenticated && !isOwn && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setReportOpen(true)}
              >
                <Flag className="size-3.5" /> Report this product
              </button>
            )}
          </div>
        </div>

        <ProductReviews productId={product.id} shopName={shop?.shopName} />

        <div className="mt-16 space-y-14">
          {shop && (
            <ProductRow
              title={`More from ${shop.shopName}`}
              products={moreFromShop}
              moreHref={`/artisan/${shop.id}`}
              moreLabel="Visit shop"
              favoriteIds={favoriteIds}
            />
          )}
          <ProductRow
            title="You may also like"
            products={others(similar)}
            isLoading={similarLoading}
            favoriteIds={favoriteIds}
          />
          <ProductRow title="Recently viewed" products={others(recentlyViewed)} favoriteIds={favoriteIds} />
        </div>
      </div>

      {/* Phones: price and buy buttons stay in reach while scrolling. */}
      {canBuy && (
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 p-3 md:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 shrink-0">
              <p className="truncate text-xs text-muted-foreground">{product.title}</p>
              <p className="font-display text-lg font-semibold text-primary">{priceLabel ?? formatMoney(minPrice)}</p>
            </div>
            {buyButtons("default", "min-w-0 flex-1")}
          </div>
        </div>
      )}

      {buying && (
        <BuyProductDialog
          product={product}
          open={buying}
          onOpenChange={(open) => {
            if (!open) setBuying(false);
          }}
        />
      )}
      <ReportDialog
        targetType="product"
        targetId={product.id}
        targetLabel={product.title}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </main>
  );
}
