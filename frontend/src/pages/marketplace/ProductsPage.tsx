import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, Package, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { useAuthStore } from "@/store/auth.store";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useCartStore } from "@/store/cart.store";
import { shopCanAcceptPayments } from "@/lib/stripe";

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  const [searchInput, setSearchInput] = useState(search);
  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);

  const { data: categories } = useCategories();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: favoriteIds } = useFavoriteIds("product", {
    enabled: isAuthenticated,
  });
  const addToCart = useCartStore((s) => s.addItem);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [wrongShop, setWrongShop] = useState(false);

  const {
    data: products,
    isLoading,
    isError,
  } = useProducts({
    search: search || undefined,
    category: category || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (searchInput.trim()) next.search = searchInput.trim();
    if (category) next.category = category;
    if (minInput) next.minPrice = minInput;
    if (maxInput) next.maxPrice = maxInput;
    setSearchParams(next);
  };

  const setCategory = (value: string) => {
    const next: Record<string, string> = {};
    if (search) next.search = search;
    if (value) next.category = value;
    if (minPrice) next.minPrice = minPrice;
    if (maxPrice) next.maxPrice = maxPrice;
    setSearchParams(next);
  };

  const hasFilters = Boolean(search || category || minPrice || maxPrice);

  return (
    <main>
      {/* ── Page header ──────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div className="aurora opacity-60" aria-hidden="true" />
        <div className="page-shell relative py-14 sm:py-16">
          <span className="eyebrow">Marketplace</span>
          <h1 className="mt-4 font-display text-4xl font-semibold text-balance sm:text-5xl">
            Browse <span className="text-gradient">products</span>
          </h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Handmade goods from artisans across the marketplace.
          </p>
        </div>
      </section>

      <div className="page-shell py-12">
        {/* ── Filters ───────────────────────────────────────────── */}
        <form
          onSubmit={applyFilters}
          className="surface mb-10 flex flex-wrap items-end gap-4 p-5"
        >
          <div className="min-w-[200px] flex-1">
            <label htmlFor="product-search" className="field-label">
              Search
            </label>
            <Input
              id="product-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
            />
          </div>

          <div>
            <label htmlFor="product-category" className="field-label">
              Category
            </label>
            <select
              id="product-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-xl border border-input bg-card px-3.5 text-sm shadow-[var(--shadow-xs)] outline-none transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="product-min" className="field-label">
              Min $
            </label>
            <Input
              id="product-min"
              type="number"
              min="0"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              className="w-28"
            />
          </div>

          <div>
            <label htmlFor="product-max" className="field-label">
              Max $
            </label>
            <Input
              id="product-max"
              type="number"
              min="0"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              className="w-28"
            />
          </div>

          <Button type="submit">
            <SlidersHorizontal className="size-4" /> Apply
          </Button>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setMinInput("");
                setMaxInput("");
                setSearchParams({});
              }}
            >
              Reset
            </Button>
          )}
        </form>

        {wrongShop && (
          <p className="alert-note mb-6">
            Your cart already has items from another shop. Each order is paid
            out to a single artisan, so check out first (or clear the cart)
            before adding this.
          </p>
        )}

        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-80" />
            ))}
          </div>
        )}

        {isError && (
          <p className="alert-error">Couldn't load products right now.</p>
        )}

        {!isLoading && !isError && (products ?? []).length === 0 && (
          <div className="surface p-12 text-center">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-4 font-display text-lg font-semibold">
              No products match your filters
            </p>
            <p className="mt-1 text-muted-foreground">
              Try widening the price range or clearing the category.
            </p>
          </div>
        )}

        {!isLoading && !isError && (products ?? []).length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products!.map((product) => (
              <div
                key={product.id}
                className="surface-lift group relative flex flex-col overflow-hidden"
              >
                {isAuthenticated && (
                  <div className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-card/90 shadow-[var(--shadow-sm)] backdrop-blur">
                    <FavoriteButton
                      targetType="product"
                      targetId={product.id}
                      isFavorited={(favoriteIds ?? []).includes(product.id)}
                    />
                  </div>
                )}

                <Link
                  to={`/artisan/${product.shop?.id}`}
                  className="block overflow-hidden"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      loading="lazy"
                      className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-brand-50 text-brand-500">
                      <Package className="size-9" />
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <Link to={`/artisan/${product.shop?.id}`}>
                    <h3 className="font-display text-lg font-semibold hover:text-primary">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {product.shop?.shopName}
                  </p>

                  {product.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                  )}

                  <p className="mt-4 font-display text-2xl font-semibold text-primary">
                    ${Number(product.basePrice).toFixed(2)}
                  </p>

                  <div className="mt-4 pt-1">
                    {isAuthenticated ? (
                      // Matches ArtisanShopPage: a shop that can't take payment
                      // shouldn't offer a buy path that fails at checkout.
                      !shopCanAcceptPayments(product.shop ?? {}) ? (
                        <Button variant="outline" className="w-full" disabled>
                          Not available yet
                        </Button>
                      ) : product.variantOptions?.length ? (
                        <Button asChild variant="outline" className="w-full">
                          <Link to={`/artisan/${product.shop?.id}`}>
                            Select options
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant={
                            justAdded === product.id ? "jade" : "default"
                          }
                          className="w-full"
                          onClick={() => {
                            if (!addToCart(product)) {
                              setWrongShop(true);
                              return;
                            }
                            setWrongShop(false);
                            setJustAdded(product.id);
                            setTimeout(() => setJustAdded(null), 1500);
                          }}
                        >
                          {justAdded === product.id ? (
                            <>
                              <Check className="size-4" /> Added
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="size-4" /> Add to cart
                            </>
                          )}
                        </Button>
                      )
                    ) : (
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/login">Log in to buy</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
