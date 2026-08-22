import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useShop } from "@/hooks/useShops";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useStartConversation } from "@/hooks/useConversations";
import { BookServiceDialog } from "@/components/booking/BookServiceDialog";
import { BuyProductDialog } from "@/components/booking/BuyProductDialog";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ReportDialog } from "@/components/ReportDialog";
import type { Product, Service } from "@/types";

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

export default function ArtisanShopPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: shop, isLoading, isError } = useShop(id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const addToCart = useCartStore((s) => s.addItem);
  const startConversation = useStartConversation();
  const isOwnShop = shop?.owner?.id === user?.id;
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-64 rounded-xl bg-white/60 animate-pulse mb-8" />
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-white/60 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (isError || !shop) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/categories"
            className="text-orange-700 hover:text-orange-800 mb-4 inline-block font-semibold"
          >
            ← Back to Categories
          </Link>
          <p className="text-red-700 bg-red-50 border-2 border-red-200 rounded-lg p-4">
            This shop couldn't be found — it may no longer be active.
          </p>
        </div>
      </main>
    );
  }

  const whatsappLink = shop.phone
    ? `https://wa.me/${digitsOnly(shop.phone)}?text=Hi%20${encodeURIComponent(
        shop.shopName,
      )},%20I%20am%20interested%20in%20your%20services.`
    : undefined;
  const phoneLink = shop.phone ? `tel:${shop.phone}` : undefined;

  const services = (shop.services ?? []).filter((s) => s.isAvailable);

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Shop Header */}
        <div className="mb-8">
          <Link
            to={shop.category ? `/category/${shop.category.id}` : "/categories"}
            className="text-orange-700 hover:text-orange-800 mb-4 inline-block font-semibold"
          >
            ← Back to {shop.category ? shop.category.name : "Categories"}
          </Link>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-orange-300 p-8 space-y-6 shadow-lg">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent">
                  {shop.shopName}
                </h1>
                {shop.averageRating > 0 && (
                  <span className="text-sm font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                    ⭐ {shop.averageRating.toFixed(1)}
                  </span>
                )}
                {shop.verificationStatus === "verified" && (
                  <span
                    className="text-sm font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-full border border-blue-300"
                    title="This shop has been verified by our team"
                  >
                    ✓ Verified
                  </span>
                )}
                {isAuthenticated && !isOwnShop && (
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline ml-auto"
                    onClick={() => setReportOpen(true)}
                  >
                    Report
                  </button>
                )}
              </div>
              {shop.description && (
                <p className="text-amber-900 text-lg max-w-2xl leading-relaxed">
                  {shop.description}
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div className="space-y-4 pt-6 border-t-2 border-orange-200">
              <h2 className="text-xl font-semibold text-orange-900">
                Contact Information
              </h2>

              {shop.address && (
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="font-medium text-orange-900">Address</p>
                    <p className="text-amber-800">
                      {shop.city ? `${shop.address}, ${shop.city}` : shop.address}
                    </p>
                  </div>
                </div>
              )}

              {(whatsappLink || phoneLink) && (
                <div className="flex gap-3 pt-4 flex-wrap">
                  {whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                        💬 Contact on WhatsApp
                      </Button>
                    </a>
                  )}
                  {phoneLink && (
                    <a href={phoneLink}>
                      <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                        📞 Call
                      </Button>
                    </a>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 flex-wrap">
                {isAuthenticated && !isOwnShop && (
                  <Button
                    variant="outline"
                    disabled={startConversation.isPending}
                    onClick={() =>
                      startConversation.mutate(shop.id, {
                        onSuccess: (conversation) =>
                          navigate(`/messages/${conversation.id}`),
                      })
                    }
                  >
                    {startConversation.isPending ? "Opening..." : "✉️ Message"}
                  </Button>
                )}
                {!isAuthenticated && (
                  <Link to="/login">
                    <Button variant="outline">✉️ Message</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {(shop.photos ?? []).length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {shop.photos!.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption ?? shop.shopName}
                  className="w-full aspect-square object-cover rounded-xl border-2 border-orange-100"
                />
              ))}
            </div>
          </div>
        )}

        {/* Services Section */}
        <div>
          <h2 className="text-3xl font-bold text-orange-900 mb-6">
            Available Services
          </h2>

          {services.length === 0 && (
            <p className="text-amber-900 bg-white/70 border-2 border-orange-100 rounded-xl p-6">
              This shop hasn't listed any services yet.
            </p>
          )}

          {services.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white/90 backdrop-blur-sm border-2 border-orange-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-bold text-orange-800 mb-2">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-amber-900 text-sm mb-4">
                      {service.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      ${Number(service.price).toFixed(2)}
                    </span>
                    {service.duration && (
                      <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                        {service.duration}
                      </span>
                    )}
                  </div>
                  {isAuthenticated ? (
                    <Button
                      className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                      onClick={() => setBookingService(service)}
                    >
                      Book Now
                    </Button>
                  ) : (
                    <Link to="/login" className="block">
                      <Button variant="outline" className="w-full">
                        Login to Book
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products Section */}
        {(shop.products ?? []).length > 0 && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-orange-900 mb-6">Products</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {shop.products!.map((product) => (
                <div
                  key={product.id}
                  className="bg-white/90 backdrop-blur-sm border-2 border-orange-200 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-orange-800 mb-2">
                      {product.title}
                    </h3>
                    {product.description && (
                      <p className="text-amber-900 text-sm mb-4">
                        {product.description}
                      </p>
                    )}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        ${Number(product.basePrice).toFixed(2)}
                      </span>
                    </div>
                    {isAuthenticated ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            addToCart(product);
                            setJustAdded(product.id);
                            setTimeout(() => setJustAdded(null), 1500);
                          }}
                        >
                          {justAdded === product.id ? "Added ✓" : "Add to Cart"}
                        </Button>
                        <Button
                          className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
                          onClick={() => setBuyingProduct(product)}
                        >
                          Buy Now
                        </Button>
                      </div>
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
          </div>
        )}

        <ReviewsSection shopId={shop.id} />

        {/* CTA */}
        {whatsappLink && (
          <div className="mt-12 bg-gradient-to-r from-orange-100 to-amber-100 rounded-xl p-8 text-center border-2 border-orange-300 shadow-lg">
            <h3 className="text-2xl font-bold text-orange-900 mb-4">
              Ready to work with {shop.shopName}?
            </h3>
            <p className="text-amber-900 mb-6 text-lg">
              Get in touch directly to discuss your project requirements.
            </p>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8"
              >
                Send Message on WhatsApp
              </Button>
            </a>
          </div>
        )}
      </div>

      {bookingService && (
        <BookServiceDialog
          service={bookingService}
          open={Boolean(bookingService)}
          onOpenChange={(open) => {
            if (!open) setBookingService(null);
          }}
        />
      )}

      {buyingProduct && (
        <BuyProductDialog
          product={buyingProduct}
          open={Boolean(buyingProduct)}
          onOpenChange={(open) => {
            if (!open) setBuyingProduct(null);
          }}
        />
      )}

      <ReportDialog
        targetType="shop"
        targetId={shop.id}
        targetLabel={shop.shopName}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </main>
  );
}
