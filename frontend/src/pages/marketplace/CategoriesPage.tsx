import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useCategories";
import { useShops } from "@/hooks/useShops";
import { themeForCategory } from "@/lib/categoryTheme";

const PAGE_SIZE = 12;

function SearchResults({ query }: { query: string }) {
  const [page, setPage] = useState(1);
  const { data: shopsPage, isLoading, isError } = useShops({
    search: query,
    limit: PAGE_SIZE,
    page,
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-amber-950">
          Search results for "{query}"
        </h2>
        <Link to="/categories" className="text-sm text-orange-700 hover:underline">
          Clear search
        </Link>
      </div>

      {isLoading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-white/60 border-2 border-amber-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-red-700 bg-red-50 border-2 border-red-200 rounded-lg p-4">
          Couldn't search right now. Please try again shortly.
        </p>
      )}

      {!isLoading && !isError && shopsPage?.data.length === 0 && (
        <p className="text-amber-900">
          No artisans matched "{query}" — try a different search.
        </p>
      )}

      {!isLoading && !isError && shopsPage && shopsPage.data.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shopsPage.data.map((shop) => (
            <Link key={shop.id} to={`/artisan/${shop.id}`}>
              <div className="bg-white/90 backdrop-blur-sm border-2 border-amber-200 rounded-xl p-6 h-full hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
                <h3 className="text-xl font-bold text-amber-900 mb-1">
                  {shop.shopName}
                </h3>
                {shop.category && (
                  <p className="text-xs font-semibold text-orange-700 mb-2">
                    {shop.category.name}
                  </p>
                )}
                {shop.description && (
                  <p className="text-amber-800 text-sm mb-4">{shop.description}</p>
                )}
                {shop.address && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📍</span>
                    <p className="text-sm text-amber-700">
                      {shop.city ? `${shop.address}, ${shop.city}` : shop.address}
                    </p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && !isError && shopsPage && shopsPage.meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </Button>
          <span className="text-sm text-amber-900">
            Page {shopsPage.meta.page} of {shopsPage.meta.lastPage}
          </span>
          <Button
            variant="outline"
            disabled={page >= shopsPage.meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
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
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent mb-4">
            Browse Categories
          </h1>
          <p className="text-xl text-amber-900 mb-8">
            Explore different artisan categories and find the perfect
            services for your needs.
          </p>

          <form onSubmit={handleSearch} className="max-w-xl">
            <div className="flex gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg border-2 border-orange-200 shadow-md">
              <Input
                type="text"
                placeholder="Search artisans or services..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0"
              />
              <Button type="submit">Search</Button>
            </div>
          </form>
        </div>

        {search ? (
          <SearchResults key={search} query={search} />
        ) : (
          <>
            {isLoading && (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-40 rounded-xl bg-white/50 border-2 border-orange-100 animate-pulse"
                  />
                ))}
              </div>
            )}

            {isError && (
              <p className="text-red-700 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                Couldn't load categories right now. Please try again shortly.
              </p>
            )}

            {!isLoading && !isError && categories?.length === 0 && (
              <p className="text-amber-900">No categories yet — check back soon.</p>
            )}

            {!isLoading && !isError && categories && categories.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((category) => {
                  const theme = themeForCategory(category.id);
                  return (
                    <Link key={category.id} to={`/category/${category.id}`}>
                      <div
                        className={`bg-gradient-to-br ${theme.gradient} border-2 ${theme.border} rounded-xl p-6 h-full hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <h3 className={`text-2xl font-bold ${theme.text}`}>
                            {category.name}
                          </h3>
                          {category.iconUrl?.startsWith("http") ? (
                            <img
                              src={category.iconUrl}
                              alt=""
                              className="w-10 h-10 object-contain"
                            />
                          ) : (
                            <span className="text-4xl">
                              {category.iconUrl ?? theme.fallbackIcon}
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p className={`text-sm ${theme.text} opacity-90 mb-4`}>
                            {category.description}
                          </p>
                        )}
                        <p className={`text-xs font-semibold ${theme.text} opacity-70`}>
                          View artisans →
                        </p>
                      </div>
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
