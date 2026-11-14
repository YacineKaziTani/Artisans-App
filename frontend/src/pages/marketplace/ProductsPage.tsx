import { useState } from "react";
import { useSearchParams } from "react-router";
import { Package, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { useAuthStore } from "@/store/auth.store";
import { ProductCard } from "@/components/ProductCard";
import { Pagination } from "@/components/Pagination";
import type { ProductSort } from "@/api/product.api";
import { PageMeta } from "@/components/PageMeta";

const PAGE_SIZE = 12;

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top-rated shops" },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const city = searchParams.get("city") ?? "";
  const minRating = searchParams.get("minRating") ?? "";
  const inStock = searchParams.get("inStock") === "true";
  const sort = (searchParams.get("sort") as ProductSort | null) ?? "newest";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);
  const [cityInput, setCityInput] = useState(city);

  const { data: categories } = useCategories();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: favoriteIds } = useFavoriteIds("product", {
    enabled: isAuthenticated,
  });

  const {
    data: productsPage,
    isLoading,
    isError,
    isFetching,
  } = useProducts({
    search: search || undefined,
    category: category || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    city: city || undefined,
    minRating: minRating ? Number(minRating) : undefined,
    inStock: inStock || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const products = productsPage?.data;

  /** Merge changes into the URL; any filter change goes back to page 1. */
  const updateParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setSearchParams(next);
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({
      search: searchInput.trim() || undefined,
      minPrice: minInput || undefined,
      maxPrice: maxInput || undefined,
      city: cityInput.trim() || undefined,
    });
  };

  const setCategory = (value: string) => updateParams({ category: value || undefined });

  const goToPage = (next: number) => {
    updateParams({ page: next > 1 ? String(next) : undefined });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasFilters = Boolean(search || category || minPrice || maxPrice || city || minRating || inStock);

  return (
    <main>
      <PageMeta title="Handmade products" description="Browse handmade goods from independent artisans — filter by category, city, price and rating." />
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
              placeholder="Products or shops…"
            />
          </div>

          <div>
            <label htmlFor="product-city" className="field-label">
              City
            </label>
            <Input
              id="product-city"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Any"
              className="w-36"
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

          <div>
            <label htmlFor="product-rating" className="field-label">
              Shop rating
            </label>
            <select
              id="product-rating"
              value={minRating}
              onChange={(e) => updateParams({ minRating: e.target.value || undefined })}
              className="h-11 rounded-xl border border-input bg-card px-3.5 text-sm shadow-[var(--shadow-xs)] outline-none transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <option value="">Any</option>
              <option value="4">4 stars &amp; up</option>
              <option value="3">3 stars &amp; up</option>
            </select>
          </div>

          <label className="flex h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => updateParams({ inStock: e.target.checked ? "true" : undefined })}
            />
            In stock only
          </label>

          <div>
            <label htmlFor="product-sort" className="field-label">
              Sort
            </label>
            <select
              id="product-sort"
              value={sort}
              onChange={(e) =>
                updateParams({
                  sort: e.target.value === "newest" ? undefined : e.target.value,
                })
              }
              className="h-11 rounded-xl border border-input bg-card px-3.5 text-sm shadow-[var(--shadow-xs)] outline-none transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                setCityInput("");
                setSearchParams({});
              }}
            >
              Reset
            </Button>
          )}
        </form>

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
              <ProductCard
                key={product.id}
                product={product}
                favorited={(favoriteIds ?? []).includes(product.id)}
                showDescription
              />
            ))}
          </div>
        )}

        <Pagination
          className="mt-10"
          meta={productsPage?.meta}
          onPageChange={goToPage}
          disabled={isFetching}
        />
      </div>
    </main>
  );
}
