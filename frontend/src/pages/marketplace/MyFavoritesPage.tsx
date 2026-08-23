import { Link } from "react-router";
import { useMyFavorites } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/FavoriteButton";

export default function MyFavoritesPage() {
  const { data, isLoading, isError } = useMyFavorites();

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
          <p className="text-gray-600">Shops and products you've saved</p>
        </div>

        {isLoading && (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-white animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
            Couldn't load your favorites right now.
          </p>
        )}

        {!isLoading && !isError && (
          <>
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Shops</h2>
              {data!.shops.length === 0 ? (
                <p className="text-sm text-gray-600">No favorited shops yet.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {data!.shops.map((shop) => (
                    <div
                      key={shop.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
                    >
                      <Link to={`/artisan/${shop.id}`} className="flex-1">
                        <p className="font-medium text-gray-900 hover:underline">
                          {shop.shopName}
                        </p>
                        <p className="text-sm text-gray-500">{shop.category?.name}</p>
                      </Link>
                      <FavoriteButton targetType="shop" targetId={shop.id} isFavorited />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Products</h2>
              {data!.products.length === 0 ? (
                <p className="text-sm text-gray-600">No favorited products yet.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {data!.products.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
                    >
                      <Link to={`/artisan/${product.shop?.id}`} className="flex-1">
                        <p className="font-medium text-gray-900 hover:underline">
                          {product.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {product.shop?.shopName} · $
                          {Number(product.basePrice).toFixed(2)}
                        </p>
                      </Link>
                      <FavoriteButton targetType="product" targetId={product.id} isFavorited />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
