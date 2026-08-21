import { useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { useShops } from "@/hooks/useShops";
import { themeForCategory } from "@/lib/categoryTheme";

const PAGE_SIZE = 12;

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const category = categories?.find((c) => c.id === id);
  const theme = themeForCategory(id ?? "");
  const [page, setPage] = useState(1);

  const {
    data: shopsPage,
    isLoading: shopsLoading,
    isError: shopsError,
  } = useShops(
    { category: category?.name, limit: PAGE_SIZE, page },
    { enabled: Boolean(category) },
  );

  const notFound = !categoriesLoading && !category;

  return (
    <main
      className={`min-h-screen bg-gradient-to-br ${theme.bg} via-orange-50 to-orange-100 py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-6xl mx-auto">
        <Link
          to="/categories"
          className="text-orange-700 hover:text-orange-800 mb-6 inline-block font-semibold"
        >
          ← Back to Categories
        </Link>

        {categoriesLoading && (
          <div className="mb-12 h-40 rounded-xl bg-white/50 animate-pulse" />
        )}

        {notFound && (
          <p className="text-red-700 bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-12">
            This category doesn't exist.
          </p>
        )}

        {category && (
          <div
            className={`mb-12 bg-gradient-to-r ${theme.gradient} border-2 ${theme.border} rounded-xl p-8`}
          >
            <div className="flex items-center gap-4 mb-4">
              {category.iconUrl?.startsWith("http") ? (
                <img src={category.iconUrl} alt="" className="w-16 h-16 object-contain" />
              ) : (
                <span className="text-6xl">
                  {category.iconUrl ?? theme.fallbackIcon}
                </span>
              )}
              <div>
                <h1 className={`text-4xl font-bold ${theme.text}`}>
                  {category.name}
                </h1>
                {category.description && (
                  <p className={`text-lg ${theme.text} opacity-80`}>
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <h2 className="text-3xl font-bold text-amber-950 mb-8">
          Available Artisans
        </h2>

        {shopsLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-white/60 border-2 border-amber-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {shopsError && (
          <p className="text-red-700 bg-red-50 border-2 border-red-200 rounded-lg p-4">
            Couldn't load artisans right now. Please try again shortly.
          </p>
        )}

        {!shopsLoading && !shopsError && shopsPage?.data.length === 0 && (
          <p className="text-amber-900">
            No artisans in this category yet — check back soon.
          </p>
        )}

        {!shopsLoading && !shopsError && shopsPage && shopsPage.data.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopsPage.data.map((shop) => (
              <Link key={shop.id} to={`/artisan/${shop.id}`}>
                <div className="bg-white/90 backdrop-blur-sm border-2 border-amber-200 rounded-xl p-6 h-full hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
                  <h3 className="text-xl font-bold text-amber-900 mb-2">
                    {shop.shopName}
                  </h3>
                  {shop.description && (
                    <p className="text-amber-800 text-sm mb-4">
                      {shop.description}
                    </p>
                  )}
                  {shop.address && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">📍</span>
                      <p className="text-sm text-amber-700">
                        {shop.city ? `${shop.address}, ${shop.city}` : shop.address}
                      </p>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                  >
                    View Shop
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!shopsLoading &&
          !shopsError &&
          shopsPage &&
          shopsPage.meta.lastPage > 1 && (
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
    </main>
  );
}
