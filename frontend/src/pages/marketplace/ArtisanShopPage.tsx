import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useShop } from "@/hooks/useShops";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useStartConversation } from "@/hooks/useConversations";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/FavoriteButton";
import { BookServiceDialog } from "@/components/booking/BookServiceDialog";
import { BuyProductDialog } from "@/components/booking/BuyProductDialog";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ReportDialog } from "@/components/ReportDialog";
import { shopCanAcceptPayments } from "@/lib/stripe";
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
  const { data: favoriteIds } = useFavoriteIds("shop", { enabled: isAuthenticated });
  const isOwnShop = shop?.owner?.id === user?.id;
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [wrongShop, setWrongShop] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (isLoading) {
    return (
      <main className="page-shell py-12">
        <div className="max-w-4xl mx-auto">
          <div className="h-64 rounded-xl bg-card animate-pulse mb-8" />
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (isError || !shop) {
    return (
      <main className="page-shell py-12">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/categories"
            className="text-muted-foreground hover:text-foreground mb-4 inline-block font-semibold"
          >
            ← Back to Categories
          </Link>
          <p className="text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-4">
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
    <main className="page-shell py-12">
      <div className="max-w-4xl mx-auto">
        {/* Shop Header */}
        <div className="mb-8">
          <Link
            to={shop.category ? `/category/${shop.category.id}` : "/categories"}
            className="text-muted-foreground hover:text-foreground mb-4 inline-block font-semibold"
          >
            ← Back to {shop.category ? shop.category.name : "Categories"}
          </Link>

          {!isOwnShop && !shopCanAcceptPayments(shop) && (
            <div className="mb-4 p-4 bg-warning/10 border border-warning/25 rounded-lg text-sm text-foreground/80">
              This shop is still setting up payouts — bookings and purchases
              aren't available yet. Check back soon.
            </div>
          )}

          <div className="bg-muted/40 rounded-xl border border-border p-8 space-y-6 shadow-[var(--shadow-lg)]">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-4xl font-bold text-gradient">
                  {shop.shopName}
                </h1>
                {shop.averageRating > 0 && (
                  <span className="text-sm font-semibold text-muted-foreground bg-warning/10 px-3 py-1 rounded-full border border-warning/25">
                    ⭐ {shop.averageRating.toFixed(1)}
                  </span>
                )}
                {shop.verificationStatus === "verified" && (
                  <span
                    className="text-sm font-semibold text-sky-800 bg-sky-100 px-3 py-1 rounded-full border border-sky-200"
                    title="This shop has been verified by our team"
                  >
                    ✓ Verified
                  </span>
                )}
                {isAuthenticated && !isOwnShop && (
                  <FavoriteButton
                    targetType="shop"
                    targetId={shop.id}
                    isFavorited={(favoriteIds ?? []).includes(shop.id)}
                  />
                )}
                {isAuthenticated && !isOwnShop && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline ml-auto"
                    onClick={() => setReportOpen(true)}
                  >
                    Report
                  </button>
                )}
              </div>
              {shop.description && (
                <p className="text-foreground/80 text-lg max-w-2xl leading-relaxed">
                  {shop.description}
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div className="space-y-4 pt-6 border-t-2 border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Contact Information
              </h2>

              {shop.address && (
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="font-medium text-foreground">Address</p>
                    <p className="text-muted-foreground">
                      {shop.city ? `${shop.address}, ${shop.city}` : shop.address}
                    </p>
                  </div>
                </div>
              )}

              {(whatsappLink || phoneLink) && (
                <div className="flex gap-3 pt-4 flex-wrap">
                  {whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <Button className="bg-jade-500 text-white hover:bg-jade-600">
                        💬 Contact on WhatsApp
                      </Button>
                    </a>
                  )}
                  {phoneLink && (
                    <a href={phoneLink}>
                      <Button className="bg-jade-500 text-white hover:bg-jade-600">
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
            <h2 className="text-3xl font-bold text-foreground mb-6">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {shop.photos!.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption ?? shop.shopName}
                  className="w-full aspect-square object-cover rounded-xl border border-border"
                />
              ))}
            </div>
          </div>
        )}

        {/* Services Section */}
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Available Services
          </h2>

          {services.length === 0 && (
            <p className="text-foreground/80 bg-white/70 border border-border rounded-xl p-6">
              This shop hasn't listed any services yet.
            </p>
          )}

          {services.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-card border border-border rounded-xl p-6 shadow-[var(--shadow-md)] hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-bold text-primary mb-2">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-foreground/80 text-sm mb-4">
                      {service.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-3xl font-bold text-gradient">
                      ${Number(service.price).toFixed(2)}
                    </span>
                    {service.duration && (
                      <span className="text-sm font-semibold text-muted-foreground bg-warning/10 px-3 py-1 rounded-full border border-warning/25">
                        {service.duration}
                      </span>
                    )}
                  </div>
                  {isAuthenticated ? (
                    <Button
                      className="w-full btn-gradient text-white"
                      disabled={!shopCanAcceptPayments(shop)}
                      onClick={() => setBookingService(service)}
                    >
                      {shopCanAcceptPayments(shop) ? "Book Now" : "Not Available Yet"}
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
            <h2 className="text-3xl font-bold text-foreground mb-6">Products</h2>
            {wrongShop && (
              <p className="mb-4 p-3 bg-warning/10 border border-warning/25 rounded-lg text-foreground/80 text-sm">
                Your cart already has items from another shop. Each order pays
                out to a single artisan, so check out first (or clear the cart)
                before adding this one.
              </p>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              {shop.products!.map((product) => (
                <div
                  key={product.id}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-[var(--shadow-md)] hover:shadow-lg transition-shadow"
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-primary mb-2">
                      {product.title}
                    </h3>
                    {product.description && (
                      <p className="text-foreground/80 text-sm mb-4">
                        {product.description}
                      </p>
                    )}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-3xl font-bold text-gradient">
                        ${Number(product.basePrice).toFixed(2)}
                      </span>
                    </div>
                    {isAuthenticated ? (
                      <div className="flex gap-2">
                        {!product.variantOptions?.length && (
                          <Button
                            variant="outline"
                            className="flex-1"
                            disabled={!shopCanAcceptPayments(shop)}
                            onClick={() => {
                              if (!addToCart(product)) {
                                setWrongShop(true);
                                return;
                              }
                              setWrongShop(false);
                              setJustAdded(product.id);
                              setTimeout(() => setJustAdded(null), 1500);
                            }}
                          >
                            {justAdded === product.id ? "Added ✓" : "Add to Cart"}
                          </Button>
                        )}
                        <Button
                          className="flex-1 btn-gradient text-white"
                          disabled={!shopCanAcceptPayments(shop)}
                          onClick={() => setBuyingProduct(product)}
                        >
                          {!shopCanAcceptPayments(shop)
                            ? "Not Available Yet"
                            : product.variantOptions?.length
                              ? "Select Options"
                              : "Buy Now"}
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
          <div className="surface mt-12 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Ready to work with {shop.shopName}?
            </h3>
            <p className="text-foreground/80 mb-6 text-lg">
              Get in touch directly to discuss your project requirements.
            </p>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-jade-500 text-white hover:bg-jade-600 px-8"
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
