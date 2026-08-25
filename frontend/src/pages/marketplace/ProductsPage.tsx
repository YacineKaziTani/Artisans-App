import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { useAuthStore } from "@/store/auth.store";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useCartStore } from "@/store/cart.store";

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
  const { data: favoriteIds } = useFavoriteIds("product", { enabled: isAuthenticated });
  const addToCart = useCartStore((s) => s.addItem);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const { data: products, isLoading, isError } = useProducts({
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent mb-4">
            Browse Products
          </h1>
          <p className="text-xl text-amber-900 mb-8">
            Handmade goods from artisans across the marketplace.
          </p>

          <form
            onSubmit={applyFilters}
            className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border-2 border-orange-200 shadow-md flex flex-wrap gap-3 items-end"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-amber-900 mb-1">Search</label>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-input flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
              >
                <option value="">All</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Min $</label>
              <Input
                type="number"
                min="0"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                className="w-24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">Max $</label>
              <Input
                type="number"
                min="0"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                className="w-24"
              />
            </div>
            <Button type="submit">Apply Filters</Button>
          </form>
        </div>

        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-white/60 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-700 bg-red-50 border-2 border-red-200 rounded-lg p-4">
            Couldn't load products right now.
          </p>
        )}

        {!isLoading && !isError && (products ?? []).length === 0 && (
          <p className="text-amber-900">No products match your filters.</p>
        )}

        {!isLoading && !isError && (products ?? []).length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products!.map((product) => (
              <div
                key={product.id}
                className="bg-white/90 backdrop-blur-sm border-2 border-orange-200 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow relative"
              >
                {isAuthenticated && (
                  <div className="absolute top-3 right-3 z-10 bg-white/90 rounded-full w-9 h-9 flex items-center justify-center">
                    <FavoriteButton
                      targetType="product"
                      targetId={product.id}
                      isFavorited={(favoriteIds ?? []).includes(product.id)}
                    />
                  </div>
                )}
                <Link to={`/artisan/${product.shop?.id}`}>
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                </Link>
                <div className="p-6">
                  <Link to={`/artisan/${product.shop?.id}`}>
                    <h3 className="text-xl font-bold text-orange-800 mb-1 hover:underline">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="text-xs font-semibold text-amber-700 mb-2">
                    {product.shop?.shopName}
                  </p>
                  {product.description && (
                    <p className="text-amber-900 text-sm mb-4 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      ${Number(product.basePrice).toFixed(2)}
                    </span>
                  </div>
                  {isAuthenticated ? (
                    product.variantOptions?.length ? (
                      <Link to={`/artisan/${product.shop?.id}`} className="block">
                        <Button variant="outline" className="w-full">
                          Select Options
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          addToCart(product);
                          setJustAdded(product.id);
                          setTimeout(() => setJustAdded(null), 1500);
                        }}
                      >
                        {justAdded === product.id ? "Added ✓" : "Add to Cart"}
                      </Button>
                    )
                  ) : (
                    <Link to="/login" className="block">
                      <Button variant="outline" className="w-full">
                        Login to Buy
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
