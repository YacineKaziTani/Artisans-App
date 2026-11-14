import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, MapPin, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { useShops } from "@/hooks/useShops";
import { themeForCategory } from "@/lib/categoryTheme";
import { img } from "@/lib/images";
import { PageMeta } from "@/components/PageMeta";

const PAGE_SIZE = 12;

function ShopCard({
  id,
  shopName,
  categoryName,
  description,
  address,
  city,
  rating,
}: {
  id: string;
  shopName: string;
  categoryName?: string;
  description?: string;
  address?: string;
  city?: string;
  rating?: number;
}) {
  return (
    <Link to={`/artisan/${id}`} className="surface-lift group flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{shopName}</h3>
        {rating && rating > 0 ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
            <Star className="size-3 fill-star text-star" />
            {rating.toFixed(1)}
          </span>
        ) : null}
      </div>

      {categoryName && (
        <span className="mt-2 w-fit rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
          {categoryName}
        </span>
      )}

      {description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {address && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{city ? `${address}, ${city}` : address}</span>
        </p>
      )}

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        View shop
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function SearchResults({ query }: { query: string }) {
  const [page, setPage] = useState(1);
  const {
    data: shopsPage,
    isLoading,
    isError,
  } = useShops({ search: query, limit: PAGE_SIZE, page });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">
          Results for “{query}”
          {shopsPage && (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {shopsPage.meta.total} found
            </span>
          )}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/categories">
            <X className="size-4" /> Clear search
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-52" />
          ))}
        </div>
      )}

      {isError && (
        <p className="alert-error">
          Couldn't search right now. Please try again shortly.
        </p>
      )}

      {!isLoading && !isError && shopsPage?.data.length === 0 && (
        <div className="surface p-12 text-center">
          <p className="font-display text-lg font-semibold">No matches</p>
          <p className="mt-1 text-muted-foreground">
            Nothing matched “{query}” — try a different search.
          </p>
        </div>
      )}

      {!isLoading && !isError && shopsPage && shopsPage.data.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shopsPage.data.map((shop) => (
            <ShopCard
              key={shop.id}
              id={shop.id}
              shopName={shop.shopName}
              categoryName={shop.category?.name}
              description={shop.description}
              address={shop.address}
              city={shop.city}
              rating={shop.averageRating}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && shopsPage && shopsPage.meta.lastPage > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {shopsPage.meta.page} of {shopsPage.meta.lastPage}
          </span>
          <Button
            variant="outline"
            disabled={page >= shopsPage.meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search")?.trim() ?? "";
  const [searchInput, setSearchInput] = useState(search);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) setSearchParams({ search: q });
    else setSearchParams({});
  };

  return (
    <main>
      <PageMeta title="Categories" description="Find artisans and handmade goods by craft." />
      {/* ── Page header ──────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div className="aurora opacity-60" aria-hidden="true" />
        <div className="page-shell relative py-14 sm:py-16">
          <span className="eyebrow">Directory</span>
          <h1 className="mt-4 font-display text-4xl font-semibold text-balance sm:text-5xl">
            Browse <span className="text-gradient">categories</span>
          </h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Explore artisan trades and find the right maker for your project.
          </p>

          <form onSubmit={handleSearch} className="mt-8 max-w-lg">
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--shadow-sm)] focus-within:shadow-[var(--shadow-md)]">
              <Search className="ml-2 size-[18px] shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search artisans or services…"
                aria-label="Search artisans or services"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted-foreground/70"
              />
              <Button type="submit" className="shrink-0">
                Search
              </Button>
            </div>
          </form>
        </div>
      </section>

      <div className="page-shell py-12">
        {search ? (
          <SearchResults key={search} query={search} />
        ) : (
          <>
            {isLoading && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-44" />
                ))}
              </div>
            )}

            {isError && (
              <p className="alert-error">
                Couldn't load categories right now. Please try again shortly.
              </p>
            )}

            {!isLoading && !isError && categories?.length === 0 && (
              <div className="surface p-12 text-center">
                <p className="font-display text-lg font-semibold">
                  No categories yet
                </p>
                <p className="mt-1 text-muted-foreground">Check back soon.</p>
              </div>
            )}

            {!isLoading && !isError && categories && categories.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {categories.map((category) => {
                  const theme = themeForCategory(category.id);
                  return (
                    <Link
                      key={category.id}
                      to={`/category/${category.id}`}
                      className="surface-lift group flex flex-col p-6"
                    >
                      <span
                        className={`flex size-12 items-center justify-center rounded-2xl text-2xl ${theme.chip}`}
                      >
                        {category.iconUrl?.startsWith("http") ? (
                          <img
                            {...img(category.iconUrl, 28)}
                            alt=""
                            className="size-7 object-contain"
                          />
                        ) : (
                          (category.iconUrl ?? theme.fallbackIcon)
                        )}
                      </span>

                      <h3 className="mt-5 font-display text-xl font-semibold">
                        {category.name}
                      </h3>

                      {category.description && (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {category.description}
                        </p>
                      )}

                      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-primary">
                        View artisans
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
