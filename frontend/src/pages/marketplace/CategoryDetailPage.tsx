import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useCategories";
import { useShops } from "@/hooks/useShops";
import { themeForCategory } from "@/lib/categoryTheme";
import { img } from "@/lib/images";
import { PageMeta } from "@/components/PageMeta";

const PAGE_SIZE = 12;

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const category = categories?.find((c) => c.id === id);
  const theme = themeForCategory(id ?? "");
  const [page, setPage] = useState(1);
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState<"rating" | "newest" | "name">("rating");

  const {
    data: shopsPage,
    isLoading: shopsLoading,
    isError: shopsError,
  } = useShops(
    {
      category: category?.name,
      city: city || undefined,
      minRating: minRating ? Number(minRating) : undefined,
      sort,
      limit: PAGE_SIZE,
      page,
    },
    { enabled: Boolean(category) },
  );

  const notFound = !categoriesLoading && !category;

  return (
    <main>
      <PageMeta title={category?.name ?? "Category"} description={category?.description ?? (category ? `Artisans and handmade goods in ${category.name}.` : undefined)} />
      {/* ── Category hero ────────────────────────────────────────── */}
      <section
        className={`border-b bg-gradient-to-br ${theme.wash} ${theme.ring}`}
      >
        <div className="page-shell py-10 sm:py-14">
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All categories
          </Link>

          {categoriesLoading && <div className="skeleton mt-6 h-24 max-w-lg" />}

          {notFound && (
            <p className="alert-error mt-6 max-w-lg">
              This category doesn't exist.
            </p>
          )}

          {category && (
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <span
                className={`flex size-16 items-center justify-center rounded-2xl text-3xl shadow-[var(--shadow-sm)] ${theme.chip}`}
              >
                {category.iconUrl?.startsWith("http") ? (
                  <img
                    {...img(category.iconUrl, 36)}
                    alt=""
                    className="size-9 object-contain"
                  />
                ) : (
                  (category.iconUrl ?? theme.fallbackIcon)
                )}
              </span>
              <div className="min-w-0">
                <h1
                  className={`font-display text-4xl font-semibold sm:text-5xl ${theme.text}`}
                >
                  {category.name}
                </h1>
                {category.description && (
                  <p className="mt-2 max-w-xl text-lg text-muted-foreground">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Shops in this category ───────────────────────────────── */}
      <div className="page-shell py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="section-title">Available artisans</h2>
          {shopsPage && shopsPage.meta.total > 0 && (
            <p className="text-sm text-muted-foreground">
              {shopsPage.meta.total} shop
              {shopsPage.meta.total === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {category && (
          <form
            className="surface mb-8 flex flex-wrap items-end gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setCity(cityInput.trim());
              setPage(1);
            }}
          >
            <div>
              <label htmlFor="shop-city" className="field-label">City</label>
              <Input id="shop-city" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="Any" className="h-10 w-40" />
            </div>
            <div>
              <label htmlFor="shop-rating" className="field-label">Rating</label>
              <select id="shop-rating" value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="">Any</option>
                <option value="4">4★ and up</option>
                <option value="3">3★ and up</option>
              </select>
            </div>
            <div>
              <label htmlFor="shop-sort" className="field-label">Sort</label>
              <select id="shop-sort" value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }} className="h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="rating">Top rated</option>
                <option value="newest">Newest</option>
                <option value="name">Name</option>
              </select>
            </div>
            <Button type="submit" size="sm" className="h-10">Search</Button>
            <Link
              to={`/products?category=${encodeURIComponent(category.name)}`}
              className="ml-auto inline-flex h-10 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Browse {category.name} products <ArrowRight className="size-4" />
            </Link>
          </form>
        )}

        {shopsLoading && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-52" />
            ))}
          </div>
        )}

        {shopsError && (
          <p className="alert-error">
            Couldn't load artisans right now. Please try again shortly.
          </p>
        )}

        {!shopsLoading && !shopsError && shopsPage?.data.length === 0 && (
          <div className="surface p-12 text-center">
            <p className="font-display text-lg font-semibold">
              No artisans here yet
            </p>
            <p className="mt-1 text-muted-foreground">
              Nobody has listed in this category — check back soon.
            </p>
          </div>
        )}

        {!shopsLoading && !shopsError && shopsPage && shopsPage.data.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shopsPage.data.map((shop) => (
              <Link
                key={shop.id}
                to={`/artisan/${shop.id}`}
                className="surface-lift group flex flex-col p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold">
                    {shop.shopName}
                  </h3>
                  {shop.averageRating > 0 && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                      <Star className="size-3 fill-current text-amber-500" />
                      {shop.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>

                {shop.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {shop.description}
                  </p>
                )}

                {shop.address && (
                  <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {shop.city ? `${shop.address}, ${shop.city}` : shop.address}
                    </span>
                  </p>
                )}

                <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-primary">
                  View shop
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}

        {!shopsLoading &&
          !shopsError &&
          shopsPage &&
          shopsPage.meta.lastPage > 1 && (
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
    </main>
  );
}
