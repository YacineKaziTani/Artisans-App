import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Clock,
  Flag,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Share2,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShop } from "@/hooks/useShops";
import { useAuthStore } from "@/store/auth.store";
import { useStartConversation } from "@/hooks/useConversations";
import { useFavoriteIds } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/FavoriteButton";
import { BookServiceDialog } from "@/components/booking/BookServiceDialog";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ReportDialog } from "@/components/ReportDialog";
import { ShopPracticalInfo } from "@/components/ShopPracticalInfo";
import { ProductCard } from "@/components/ProductCard";
import { ShopLogo } from "@/components/ShopCard";
import { RatingChip } from "@/components/Stars";
import { Lightbox } from "@/components/Lightbox";
import { PageMeta } from "@/components/PageMeta";
import { LoginLink } from "@/components/LoginLink";
import { shopCanAcceptPayments } from "@/lib/stripe";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/pricing";
import { img } from "@/lib/images";
import { toast } from "@/lib/toast";
import type { Service, Shop } from "@/types";

type Tab = "products" | "services" | "reviews" | "about";

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

async function shareShop(shop: Shop) {
  const url = window.location.href.split("?")[0];
  try {
    if (navigator.share) {
      await navigator.share({ title: shop.shopName, text: shop.description ?? undefined, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: "Paste it anywhere to share this shop." });
  } catch {
    // The share sheet was dismissed — nothing to do.
  }
}

function ShopPageSkeleton() {
  return (
    <main className="page-shell py-6 sm:py-10">
      <div className="skeleton h-44 rounded-3xl sm:h-64" />
      <div className="mt-6 flex gap-4">
        <div className="skeleton size-24 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-8 w-1/2" />
          <div className="skeleton h-5 w-1/3" />
        </div>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-80" />
        ))}
      </div>
    </main>
  );
}

export default function ArtisanShopPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: shop, isLoading, isError, error, refetch } = useShop(id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const startConversation = useStartConversation();
  const { data: favoriteShopIds } = useFavoriteIds("shop", { enabled: isAuthenticated });
  const { data: favoriteProductIds } = useFavoriteIds("product", { enabled: isAuthenticated });
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  if (isLoading) return <ShopPageSkeleton />;

  if (isError || !shop) {
    const notFound = !isError || (isAxiosError(error) && error.response?.status === 404);
    return (
      <main className="page-shell space-y-4 py-12">
        <Link to="/categories" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All categories
        </Link>
        {notFound ? (
          <p className="alert-error">This shop couldn't be found — it may no longer be active.</p>
        ) : (
          <>
            <p className="alert-error">{getErrorMessage(error, "Couldn't load this shop right now.")}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </>
        )}
      </main>
    );
  }

  // Both sides must exist — `undefined === undefined` would make every
  // logged-out visitor the "owner".
  const isOwnShop = Boolean(user && shop.owner && shop.owner.id === user.id);
  const canPay = shopCanAcceptPayments(shop);
  const services = (shop.services ?? []).filter((s) => s.isAvailable);
  const products = shop.products ?? [];
  const photos = (shop.photos ?? []).map((p) => p.url);
  const stats = shop.stats;
  const reviewCount = stats?.reviewCount ?? 0;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    ...(products.length ? [{ key: "products" as const, label: "Products", count: products.length }] : []),
    ...(services.length ? [{ key: "services" as const, label: "Services", count: services.length }] : []),
    { key: "reviews", label: "Reviews", count: reviewCount },
    { key: "about", label: "About" },
  ];
  const requested = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabs.some((t) => t.key === requested) ? requested! : tabs[0].key;
  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true, preventScrollReset: true });
  };

  const whatsappLink = shop.phone
    ? `https://wa.me/${digitsOnly(shop.phone)}?text=${encodeURIComponent(`Hi ${shop.shopName}, I found you on Artisan Market.`)}`
    : undefined;
  const fullAddress = shop.address ? (shop.city ? `${shop.address}, ${shop.city}` : shop.address) : shop.city;
  const memberSince = shop.createdAt ? new Date(shop.createdAt).getFullYear() : null;

  const openChat = () =>
    startConversation.mutate(shop.id, {
      onSuccess: (conversation) => navigate(`/messages/${conversation.id}`),
      onError: (err) => toast.error(getErrorMessage(err, "Couldn't open a conversation.")),
    });

  const messageButton = (className = "") =>
    isOwnShop ? null : isAuthenticated ? (
      <Button variant="outline" className={className} disabled={startConversation.isPending} onClick={openChat}>
        <MessageCircle className="size-4" /> {startConversation.isPending ? "Opening…" : "Message"}
      </Button>
    ) : (
      <Button asChild variant="outline" className={className}>
        <LoginLink>
          <MessageCircle className="size-4" /> Message
        </LoginLink>
      </Button>
    );

  return (
    <main className="pb-24 md:pb-12">
      <PageMeta
        title={shop.city ? `${shop.shopName} — artisan in ${shop.city}` : shop.shopName}
        description={shop.description ?? `Handmade work by ${shop.shopName}.`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: shop.shopName,
          description: shop.description || undefined,
          image: shop.coverUrl || shop.logoUrl || undefined,
          address: fullAddress || undefined,
          telephone: shop.phone || undefined,
          aggregateRating:
            reviewCount > 0
              ? { "@type": "AggregateRating", ratingValue: shop.averageRating.toFixed(1), reviewCount }
              : undefined,
        }}
      />

      {/* ══ Cover ═══════════════════════════════════════════════════ */}
      <div className="page-shell pt-4 sm:pt-6">
        <div className="relative h-40 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-brand-100 via-secondary to-jade-50 sm:h-64 lg:h-72">
          {shop.coverUrl ? (
            <img {...img(shop.coverUrl, 1280)} alt="" className="size-full object-cover" fetchPriority="high" />
          ) : (
            <div className="aurora opacity-80" aria-hidden="true" />
          )}
          <Link
            to={shop.category ? `/category/${shop.category.id}` : "/categories"}
            className="glass absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary"
          >
            <ArrowLeft className="size-3.5" /> {shop.category?.name ?? "Categories"}
          </Link>
        </div>

        {/* ══ Identity ══════════════════════════════════════════════ */}
        <div className="relative -mt-12 flex flex-col gap-5 px-2 sm:-mt-14 sm:flex-row sm:items-end sm:px-6">
          <ShopLogo shop={shop} className="size-24 border-4 border-background text-3xl shadow-[var(--shadow-md)] sm:size-28" />
          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-semibold text-balance sm:text-4xl">
              {shop.shopName}
              {shop.verificationStatus === "verified" && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-info/25 bg-info/10 px-2.5 py-1 font-sans text-xs font-semibold text-info"
                  title="This shop has been verified by our team"
                >
                  <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified
                </span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {shop.averageRating > 0 ? (
                <button type="button" onClick={() => selectTab("reviews")} className="hover:text-foreground">
                  <RatingChip rating={shop.averageRating} count={reviewCount} className="text-foreground" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" /> New on Artisan Market
                </span>
              )}
              {shop.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden="true" /> {shop.city}
                </span>
              )}
              {stats && stats.salesCount > 0 && (
                <span>
                  <strong className="font-semibold text-foreground">{stats.salesCount}</strong> sale{stats.salesCount === 1 ? "" : "s"}
                </span>
              )}
              {stats && stats.followerCount > 0 && (
                <span>
                  <strong className="font-semibold text-foreground">{stats.followerCount}</strong> follower{stats.followerCount === 1 ? "" : "s"}
                </span>
              )}
              {memberSince && <span>Since {memberSince}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:pb-1">
            {isAuthenticated && !isOwnShop && (
              <span className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-1 shadow-[var(--shadow-xs)]">
                <FavoriteButton
                  targetType="shop"
                  targetId={shop.id}
                  isFavorited={(favoriteShopIds ?? []).includes(shop.id)}
                />
              </span>
            )}
            {messageButton("hidden md:inline-flex")}
            {isOwnShop && (
              <Button asChild variant="outline">
                <Link to="/profile-artisan">Edit shop</Link>
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => shareShop(shop)} aria-label="Share this shop">
              <Share2 className="size-4" />
            </Button>
            {isAuthenticated && !isOwnShop && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More options">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                    <Flag className="size-4" /> Report this shop
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {shop.description && (
          <p className="mt-5 max-w-3xl px-2 text-base leading-relaxed text-pretty text-foreground/80 sm:px-6 sm:text-lg">
            {shop.description}
          </p>
        )}

        {!isOwnShop && !canPay && (
          <p className="alert-note mt-6">
            This shop is still setting up payouts — bookings and purchases aren't available yet. Check back soon.
          </p>
        )}
      </div>

      {/* ══ Tabs ══════════════════════════════════════════════════ */}
      <div className="sticky top-16 z-30 mt-8 border-b border-border/70 glass lg:top-18">
        <div className="page-shell">
          <div role="tablist" aria-label="Shop sections" className="snap-row gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`panel-${t.key}`}
                onClick={() => selectTab(t.key)}
                className={`relative shrink-0 px-4 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t.count}</span>
                )}
                {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-shell pt-8" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "products" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                // Listing cards read the shop from the product.
                product={{ ...product, shop }}
                favorited={(favoriteProductIds ?? []).includes(product.id)}
              />
            ))}
          </div>
        )}

        {tab === "services" && (
          <div className="grid gap-5 md:grid-cols-2">
            {services.map((service) => (
              <div key={service.id} className="surface flex flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-xl font-semibold">{service.name}</h3>
                  <span className="shrink-0 font-display text-xl font-semibold text-primary">{formatMoney(service.price)}</span>
                </div>
                {(service.duration || service.durationMinutes) && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-4" aria-hidden="true" />
                    {service.duration || `${service.durationMinutes} min`}
                  </p>
                )}
                {service.description && (
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-foreground/80">{service.description}</p>
                )}
                <div className="mt-auto pt-5">
                  {isOwnShop ? (
                    <p className="text-sm text-muted-foreground">This is your service — clients book it from here.</p>
                  ) : isAuthenticated ? (
                    <Button variant="gradient" className="w-full" disabled={!canPay} onClick={() => setBookingService(service)}>
                      <CalendarClock className="size-4" /> {canPay ? "Book a time" : "Not available yet"}
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <LoginLink>Log in to book</LoginLink>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "reviews" && <ReviewsSection shopId={shop.id} shopName={shop.shopName} ownerId={shop.owner?.id} className="" />}

        {tab === "about" && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-8">
              <section>
                <h2 className="font-display text-2xl font-semibold">Our story</h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-foreground/80">
                  {shop.story || shop.description || `${shop.shopName} hasn't written their story yet.`}
                </p>
              </section>

              {photos.length > 0 && (
                <section>
                  <h2 className="font-display text-2xl font-semibold">In the workshop</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {shop.photos!.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setPhotoIndex(index)}
                        className="group overflow-hidden rounded-2xl border border-border/70"
                        aria-label={`Open photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
                      >
                        <img
                          {...img(photo.url, 400)}
                          alt={photo.caption ?? ""}
                          loading="lazy"
                          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-5">
              <div className="surface space-y-5 p-6">
                {fullAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">Find us</p>
                      <p className="text-muted-foreground">{fullAddress}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block font-medium text-primary hover:underline"
                      >
                        Open in Maps
                      </a>
                    </div>
                  </div>
                )}
                <ShopPracticalInfo shop={shop} showHours={services.length > 0} showDelivery={products.length > 0} stacked />
              </div>

              {!isOwnShop && (whatsappLink || shop.phone) && (
                <div className="surface flex flex-wrap gap-2 p-6">
                  <p className="w-full text-sm font-medium">Prefer to talk?</p>
                  {whatsappLink && (
                    <Button asChild variant="jade" size="sm">
                      <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="size-4" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  {shop.phone && (
                    <Button asChild variant="outline" size="sm">
                      <a href={`tel:${shop.phone}`}>
                        <Phone className="size-4" /> Call
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {/* ══ Mobile action bar ═════════════════════════════════════ */}
      {!isOwnShop && (
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 p-3 md:hidden">
          <div className="flex gap-2">
            {messageButton("flex-1")}
            {services.length > 0 ? (
              <Button variant="gradient" className="flex-1" onClick={() => selectTab("services")}>
                <CalendarClock className="size-4" /> Book
              </Button>
            ) : products.length > 0 ? (
              <Button variant="gradient" className="flex-1" onClick={() => selectTab("products")}>
                <ShoppingBag className="size-4" /> Shop
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {bookingService && (
        <BookServiceDialog
          service={bookingService}
          shop={shop}
          open={Boolean(bookingService)}
          onOpenChange={(open) => {
            if (!open) setBookingService(null);
          }}
        />
      )}

      <Lightbox
        images={photos}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
        onClose={() => setPhotoIndex(null)}
        alt={`${shop.shopName} workshop`}
      />

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
