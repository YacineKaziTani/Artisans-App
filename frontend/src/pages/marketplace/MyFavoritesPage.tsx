import { Link } from "react-router";
import { Heart, Package, Store } from "lucide-react";
import { useMyFavorites } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/FavoriteButton";

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default function MyFavoritesPage() {
  const { data, isLoading, isError } = useMyFavorites();

  return (
    <main className="page-narrow py-12">
      <div className="mb-10 flex items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Heart className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold">My favorites</h1>
          <p className="mt-1 text-muted-foreground">
            Shops and products you've saved.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      )}

      {isError && (
        <p className="alert-error">Couldn't load your favorites right now.</p>
      )}

      {!isLoading && !isError && (
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
              <Store className="size-[18px] text-muted-foreground" /> Shops
            </h2>
            {data!.shops.length === 0 ? (
              <EmptyRow>No favorited shops yet.</EmptyRow>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data!.shops.map((shop) => (
                  <div
                    key={shop.id}
                    className="surface-lift flex items-center justify-between gap-3 p-5"
                  >
                    <Link to={`/artisan/${shop.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold hover:text-primary">
                        {shop.shopName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {shop.category?.name}
                      </p>
                    </Link>
                    <FavoriteButton
                      targetType="shop"
                      targetId={shop.id}
                      isFavorited
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
              <Package className="size-[18px] text-muted-foreground" /> Products
            </h2>
            {data!.products.length === 0 ? (
              <EmptyRow>No favorited products yet.</EmptyRow>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data!.products.map((product) => (
                  <div
                    key={product.id}
                    className="surface-lift flex items-center justify-between gap-3 p-5"
                  >
                    <Link
                      to={`/product/${product.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate font-semibold hover:text-primary">
                        {product.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {product.shop?.shopName} · $
                        {Number(product.basePrice).toFixed(2)}
                      </p>
                    </Link>
                    <FavoriteButton
                      targetType="product"
                      targetId={product.id}
                      isFavorited
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
