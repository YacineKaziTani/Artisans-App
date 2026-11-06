import { useSearchParams } from "react-router";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { useMyShop } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import { CreateShopForm } from "./artisan/CreateShopForm";
import { ShopProfileForm } from "./artisan/ShopProfileForm";
import { ShopServicesTab } from "./artisan/ShopServicesTab";
import { ShopProductsTab } from "./artisan/ShopProductsTab";
import { ShopPhotosTab } from "./artisan/ShopPhotosTab";
import { ShopBookingsTab } from "./artisan/ShopBookingsTab";
import { ShopOrdersTab } from "./artisan/ShopOrdersTab";
import { ShopHoursCard } from "./artisan/ShopHoursCard";
import { ShopDeliveryCard } from "./artisan/ShopDeliveryCard";
import { ShopEarningsTab } from "./artisan/ShopEarningsTab";
import { MyDisputesCard } from "./account/MyDisputesCard";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "services", label: "Services" },
  { id: "products", label: "Products" },
  { id: "photos", label: "Photos" },
  { id: "bookings", label: "Bookings" },
  { id: "orders", label: "Orders" },
  { id: "earnings", label: "Earnings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * The artisan's shop workspace. Each tab lives in ./artisan/; this page just
 * loads the shop and switches between them. The selected tab is kept in the
 * URL (?tab=orders), so refreshing or going back stays on it.
 */
export default function ArtisanProfilePage() {
  const { data: shop, isLoading, isError, error, refetch, isFetching } = useMyShop();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const activeTab: TabId = TABS.some((t) => t.id === requested)
    ? (requested as TabId)
    : "profile";

  const selectTab = (tab: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "profile") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  if (isLoading) {
    return (
      <main className="page-shell py-12">
        <div className="max-w-4xl mx-auto">
          <div className="h-64 rounded-xl bg-card animate-pulse" />
        </div>
      </main>
    );
  }

  // Only "no shop" (404) means "create one". Any other failure used to show
  // the create form too, inviting a second shop the API would then reject.
  const noShop = isError && isAxiosError(error) && error.response?.status === 404;

  if (isError && !noShop) {
    return (
      <main className="page-shell py-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <p className="alert-error">
            {getErrorMessage(error, "Couldn't load your shop right now.")}
          </p>
          <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </main>
    );
  }

  if (noShop || !shop) {
    return (
      <main className="page-shell py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Create Your Shop</h1>
            <p className="text-muted-foreground">
              Set up your shop to start listing services and products.
            </p>
          </div>
          <CreateShopForm />
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">My Shop</h1>
          <p className="text-muted-foreground">Manage your shop profile and services</p>
        </div>

        <div
          role="tablist"
          aria-label="Shop sections"
          className="flex gap-1 sm:gap-4 mb-8 border-b border-border overflow-x-auto"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={`px-4 py-2 font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === "profile" && <ShopProfileForm key={shop.id} shop={shop} />}
          {activeTab === "services" && (
            <div className="space-y-8">
              <ShopHoursCard key={`hours-${shop.id}`} shop={shop} />
              <ShopServicesTab services={shop.services ?? []} />
            </div>
          )}
          {activeTab === "products" && (
            <div className="space-y-8">
              <ShopDeliveryCard key={`delivery-${shop.id}`} shop={shop} />
              <ShopProductsTab />
            </div>
          )}
          {activeTab === "photos" && <ShopPhotosTab />}
          {activeTab === "bookings" && <ShopBookingsTab />}
          {activeTab === "orders" && (
            <div className="space-y-8">
              <ShopOrdersTab />
              <MyDisputesCard />
            </div>
          )}
          {activeTab === "earnings" && <ShopEarningsTab shop={shop} />}
        </div>
      </div>
    </main>
  );
}
