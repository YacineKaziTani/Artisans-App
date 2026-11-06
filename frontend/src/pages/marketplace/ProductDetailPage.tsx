import { useState } from "react";
import { Link, useParams } from "react-router";
import { isAxiosError } from "axios";
import { ArrowLeft, Check, Package, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginLink } from "@/components/LoginLink";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportDialog } from "@/components/ReportDialog";
import { BuyProductDialog } from "@/components/booking/BuyProductDialog";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { PageMeta } from "@/components/PageMeta";
import { useProduct } from "@/hooks/useProducts";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { shopCanAcceptPayments } from "@/lib/stripe";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney, variantUnitPrice } from "@/lib/pricing";
import { img } from "@/lib/images";

/**
 * A product's own page, so products can be linked to and shared — every
 * product link used to go to the whole shop page.
 */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError, error, refetch } = useProduct(id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const addToCart = useCartStore((s) => s.addItem);
  const { data: favoriteIds } = useFavoriteIds("product", { enabled: isAuthenticated });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [wrongShop, setWrongShop] = useState(false);

  if (isLoading) {
    return (
      <main className="page-shell py-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="skeleton aspect-square" />
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
      <main className="page-shell py-12 space-y-4">
        <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All products
        </Link>
        {notFound ? (
          <p className="alert-error">This product isn't available any more.</p>
        ) : (
          <>
            <p className="alert-error">{getErrorMessage(error, "Couldn't load this product.")}</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
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
  const mainImage = selectedImage ?? images[0] ?? null;
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

  return (
    <main className="page-shell py-12">
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
      {shop && (
        <Link
          to={`/artisan/${shop.id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {shop.shopName}
        </Link>
      )}

      <div className="grid gap-10 md:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-3">
          {mainImage ? (
            <img
              {...img(mainImage, 720)}
              alt={product.title}
              className="aspect-square w-full rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
              <Package className="size-12" />
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedImage(url)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={url === mainImage}
                  className={`size-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                    url === mainImage ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img {...img(url, 64)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
                {product.title}
              </h1>
              {isAuthenticated && !isOwn && (
                <FavoriteButton
                  targetType="product"
                  targetId={product.id}
                  isFavorited={(favoriteIds ?? []).includes(product.id)}
                />
              )}
            </div>
            {shop && (
              <Link
                to={`/artisan/${shop.id}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <Store className="size-4" /> {shop.shopName}
                {shop.category?.name ? ` · ${shop.category.name}` : ""}
              </Link>
            )}
          </div>

          <p className="font-display text-3xl font-semibold text-primary">
            {minPrice === maxPrice
              ? formatMoney(minPrice)
              : `${formatMoney(minPrice)} – ${formatMoney(maxPrice)}`}
          </p>

          {soldOut ? (
            <p className="text-sm font-medium text-destructive">Out of stock</p>
          ) : tracked ? (
            <p className="text-sm text-jade-600">{product.stockQuantity} in stock</p>
          ) : hasVariants ? (
            <p className="text-sm text-muted-foreground">
              Available in {variants.length} option{variants.length === 1 ? "" : "s"}
            </p>
          ) : null}

          {product.description && (
            <p className="whitespace-pre-line leading-relaxed text-foreground/80">
              {product.description}
            </p>
          )}

          {wrongShop && (
            <p className="alert-note">
              Your cart already has items from another shop. Each order is paid out
              to a single artisan, so check out first (or clear the cart) before adding this.
            </p>
          )}

          {isOwn ? (
            <p className="text-sm text-muted-foreground">
              This is your product — manage it from your shop.
            </p>
          ) : !isAuthenticated ? (
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <LoginLink>Log in to buy</LoginLink>
            </Button>
          ) : !canPay ? (
            <Button size="lg" variant="outline" disabled>
              Not available yet
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              {!hasVariants && (
                <Button
                  size="lg"
                  variant={added ? "jade" : "outline"}
                  disabled={soldOut}
                  onClick={() => {
                    if (!addToCart(product)) {
                      setWrongShop(true);
                      return;
                    }
                    setWrongShop(false);
                    setAdded(true);
                    setTimeout(() => setAdded(false), 1500);
                  }}
                >
                  {added ? <><Check className="size-4" /> Added</> : <><ShoppingBag className="size-4" /> Add to cart</>}
                </Button>
              )}
              <Button size="lg" variant="gradient" disabled={soldOut} onClick={() => setBuying(true)}>
                {hasVariants ? "Choose options" : "Buy now"}
              </Button>
            </div>
          )}

          {isAuthenticated && !isOwn && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => setReportOpen(true)}
            >
              Report this product
            </button>
          )}
        </div>
      </div>

      <ProductReviews productId={product.id} shopName={shop?.shopName} />

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
