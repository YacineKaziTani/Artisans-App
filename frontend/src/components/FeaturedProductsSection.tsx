import { Link } from "react-router";
import { ArrowRight, Package } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";

export function FeaturedProductsSection() {
  const { data: products, isLoading, isError } = useProducts({});

  const featured = (products ?? []).slice(0, 12);
  // Duplicate the list so the CSS animation can loop seamlessly at -50%.
  const track = [...featured, ...featured];

  if (isError) return null;

  return (
    <section className="overflow-hidden border-y border-border/70 bg-muted/40 py-20">
      <div className="page-shell mb-10 flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Fresh listings</span>
          <h2 className="section-title mt-3">Discover handmade goods</h2>
          <p className="mt-2 text-muted-foreground">
            Straight from artisan shops across the marketplace.
          </p>
        </div>
        <Link
          to="/products"
          className="hidden items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:inline-flex"
        >
          All products <ArrowRight className="size-4" />
        </Link>
      </div>

      {isLoading && (
        <div className="page-shell flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-72 w-64 shrink-0" />
          ))}
        </div>
      )}

      {!isLoading && featured.length === 0 && (
        <p className="page-shell text-muted-foreground">
          No products listed yet — check back soon.
        </p>
      )}

      {!isLoading && featured.length > 0 && (
        <div className="relative">
          {/* Fade edges so cards don't hard-cut at the viewport boundary */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-28" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-28" />

          <div className="product-marquee-viewport">
            <div className="product-marquee-track">
              {track.map((product, i) => (
                <Link
                  key={`${product.id}-${i}`}
                  to={`/artisan/${product.shop?.id}`}
                  className="surface-lift w-64 shrink-0 overflow-hidden"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-brand-50 text-brand-500">
                      <Package className="size-8" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="truncate font-display text-base font-semibold">
                      {product.title}
                    </h3>
                    {product.shop?.shopName && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {product.shop.shopName}
                      </p>
                    )}
                    <p className="mt-3 text-sm font-semibold text-primary">
                      ${Number(product.basePrice).toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
