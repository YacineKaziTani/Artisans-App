import { Link } from "react-router";
import { useProducts } from "@/hooks/useProducts";

export function FeaturedProductsSection() {
  const { data: products, isLoading, isError } = useProducts({});

  const featured = (products ?? []).slice(0, 12);
  // Duplicate the list so the CSS animation can loop seamlessly at -50%.
  const track = [...featured, ...featured];

  if (isError) return null;

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
          Discover Handmade Products
        </h2>
        <p className="text-gray-600 text-center">
          Fresh from artisan shops across the marketplace
        </p>
      </div>

      {isLoading && (
        <div className="flex gap-6 px-4 sm:px-6 lg:px-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-64 h-72 rounded-xl bg-gray-100 animate-pulse flex-shrink-0"
            />
          ))}
        </div>
      )}

      {!isLoading && featured.length === 0 && (
        <p className="text-center text-gray-500">
          No products listed yet — check back soon.
        </p>
      )}

      {!isLoading && featured.length > 0 && (
        <div className="relative">
          {/* Fade edges so cards don't hard-cut at the viewport boundary */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="product-marquee-viewport">
            <div className="product-marquee-track">
              {track.map((product, i) => (
                <Link
                  key={`${product.id}-${i}`}
                  to={`/artisan/${product.shop?.id}`}
                  className="w-64 flex-shrink-0 bg-white border-2 border-orange-100 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-4xl">
                      🎁
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1 truncate">
                      {product.title}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {product.description}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-orange-700">
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
