import { Link } from "react-router";
import {
  ArrowRight,
  Calendar,
  Clock,
  DollarSign,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAdminShops } from "@/hooks/useAdminShops";
import { useMyShop, useMyShopStats } from "@/hooks/useShops";
import { formatMoney } from "@/lib/pricing";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { EmailDeliveryCard } from "./admin/EmailDeliveryCard";
import { ShopSetupChecklist } from "./ShopSetupChecklist";
import { NewsletterCard } from "./admin/NewsletterCard";
import { ReferralCard } from "@/components/growth/ReferralCard";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: boolean;
  /** A short line under the number, e.g. the change vs the previous period. */
  hint?: string;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={`flex size-9 items-center justify-center rounded-xl ${
            accent
              ? "bg-brand-100 text-brand-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** "+12% vs previous 30 days" (or "new" when the previous period was empty). */
function changeHint(current: number, previous: number, days: number) {
  if (previous === 0) return current > 0 ? `New in the last ${days} days` : `None in the previous ${days} days either`;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs previous ${days} days`;
}

/** How the marketplace is doing: the last 30 days next to the 30 before. */
function AdminMetrics() {
  const { data, isError } = useQuery({
    queryKey: ["admin", "metrics", 30],
    queryFn: () => api.get<AdminMetricsData>("/metrics/admin", { params: { days: 30 } }).then((r) => r.data),
  });
  if (isError) return <p className="alert-error">Couldn't load marketplace metrics.</p>;
  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }
  const { current: c, previous: p, days } = data;
  return (
    <section className="space-y-3" aria-labelledby="metrics-title">
      <h2 id="metrics-title" className="font-display text-lg font-semibold">Last {days} days</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sales volume" value={formatMoney(c.volume)} icon={DollarSign} accent={c.volume > 0} hint={changeHint(c.volume, p.volume, days)} />
        <StatCard label={`Commission (${data.commissionPercent}%)`} value={formatMoney(c.commission)} icon={DollarSign} hint={changeHint(c.commission, p.commission, days)} />
        <StatCard label="Paid orders & bookings" value={c.sales} icon={ShoppingBag} hint={changeHint(c.sales, p.sales, days)} />
        <StatCard
          label="New sign-ups"
          value={c.newClients + c.newArtisans}
          icon={Users}
          hint={`${c.newClients} client${c.newClients === 1 ? "" : "s"}, ${c.newArtisans} artisan${c.newArtisans === 1 ? "" : "s"}`}
        />
      </div>
    </section>
  );
}

interface AdminMetricsWindow {
  sales: number;
  volume: number;
  commission: number;
  newClients: number;
  newArtisans: number;
}
interface AdminMetricsData {
  days: number;
  commissionPercent: number;
  current: AdminMetricsWindow;
  previous: AdminMetricsWindow;
  shops: Record<string, number>;
}

function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <Icon className="size-[18px] text-muted-foreground" />
      {label}
      <ArrowRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function AdminDashboardHome() {
  const { data: categories } = useAdminCategories();
  // limit: 1 — only the totals in `meta` are needed here.
  const { data: usersPage } = useAdminUsers({ limit: 1 });
  const { data: shopsPage } = useAdminShops({ limit: 1 });
  const { data: pendingPage } = useAdminShops({ status: "pending", limit: 1 });

  const pendingShops = pendingPage?.meta.total ?? 0;
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      {user && user.twoFactorEnabled === false && (
        <p className="alert-note">
          Admin accounts can refund payments and suspend shops — protect yours with{" "}
          <Link to="/profile-client#security" className="font-semibold underline">
            two-step login
          </Link>
          .
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Categories"
          value={categories?.length ?? "—"}
          icon={Tag}
        />
        <StatCard label="Users" value={usersPage?.meta.total ?? "—"} icon={Users} />
        <StatCard
          label="Shops"
          value={shopsPage?.meta.total ?? "—"}
          icon={Store}
        />
        <StatCard
          label="Pending approval"
          value={pendingShops}
          icon={Clock}
          accent={pendingShops > 0}
        />
      </div>

      <AdminMetrics />

      <EmailDeliveryCard />
      <NewsletterCard />

      <section className="surface p-6">
        <h2 className="font-display text-lg font-semibold">Quick links</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            to="/dashboard/categories"
            label="Manage categories"
            icon={Tag}
          />
          <QuickLink to="/dashboard/users" label="Manage users" icon={Users} />
          <QuickLink to="/dashboard/shops" label="Manage shops" icon={Store} />
          <QuickLink
            to="/dashboard/services"
            label="Moderate services"
            icon={Wrench}
          />
          <QuickLink
            to="/dashboard/bookings"
            label="View bookings"
            icon={Calendar}
          />
        </div>
      </section>
    </div>
  );
}

/** A to-do row that links straight to the tab where it gets done. */
function TodoLink({ to, count, label }: { to: string; count: number; label: string }) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-accent ${
        count > 0 ? "border-primary/40" : "border-border/70"
      }`}
    >
      <span
        className={`font-display text-2xl font-semibold tabular-nums ${
          count > 0 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {count}
      </span>
      {label}
      <ArrowRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function ArtisanShopStats() {
  const { data: stats, isLoading, isError } = useMyShopStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }
  if (isError || !stats) {
    return <p className="alert-error">Couldn't load your shop's numbers right now.</p>;
  }

  const { last30Days } = stats;
  const statusLabel = stats.status.charAt(0).toUpperCase() + stats.status.slice(1);

  return (
    <div className="space-y-6">
      {!stats.acceptsPayments && stats.status === "active" && (
        <p className="alert-note">
          Clients can't pay you yet — finish Stripe setup from{" "}
          <Link to="/profile-artisan" className="font-semibold underline">
            your shop
          </Link>{" "}
          so your services and products can be booked and bought.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue, last 30 days"
          value={formatMoney(last30Days.revenue)}
          icon={DollarSign}
          accent={last30Days.revenue > 0}
        />
        <StatCard
          label="Paid orders & bookings (30 days)"
          value={last30Days.paidOrders + last30Days.paidBookings}
          icon={ShoppingBag}
        />
        <StatCard
          label={`Rating (${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"})`}
          value={stats.reviewCount > 0 ? Number(stats.averageRating).toFixed(1) : "—"}
          icon={Star}
        />
        <StatCard
          label="Shop status"
          value={statusLabel}
          icon={Store}
          accent={stats.status === "active"}
        />
      </div>

      <section className="surface p-6">
        <h2 className="font-display text-lg font-semibold">Needs your attention</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <TodoLink
            to="/profile-artisan?tab=orders"
            count={stats.ordersToFulfil}
            label={`order${stats.ordersToFulfil === 1 ? "" : "s"} to fulfil`}
          />
          <TodoLink
            to="/profile-artisan?tab=bookings"
            count={stats.bookingsToConfirm}
            label={`booking${stats.bookingsToConfirm === 1 ? "" : "s"} to confirm`}
          />
          <TodoLink
            to="/profile-artisan?tab=bookings"
            count={stats.upcomingBookings}
            label={`upcoming booking${stats.upcomingBookings === 1 ? "" : "s"}`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <Link to="/profile-artisan?tab=services" className="hover:text-primary">
            {stats.serviceCount} service{stats.serviceCount === 1 ? "" : "s"}
          </Link>
          <Link to="/profile-artisan?tab=products" className="hover:text-primary">
            {stats.productCount} product{stats.productCount === 1 ? "" : "s"}
          </Link>
        </div>
      </section>
    </div>
  );
}

function ArtisanDashboardHome() {
  const { data: shop, isLoading } = useMyShop();

  return (
    <div className="space-y-6">
      {!isLoading && !shop && (
        <div className="surface relative isolate overflow-hidden p-8">
          <div className="aurora opacity-60" aria-hidden="true" />
          <div className="relative max-w-lg">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
              <Store className="size-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold">
              You don't have a shop yet
            </h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Create your shop to start listing services and products.
            </p>
            <Link
              to="/profile-artisan"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Create your shop <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {!isLoading && shop && <ShopSetupChecklist shop={shop} />}
      {!isLoading && shop && <ArtisanShopStats />}
      {!isLoading && shop && <ReferralCard audience="artisans" />}

      <section className="surface p-6">
        <h2 className="font-display text-lg font-semibold">Manage your shop</h2>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">
          Edit your shop profile, add services and products, upload photos, and
          manage bookings.
        </p>
        <Link
          to="/profile-artisan"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Go to my shop <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          Hello, {user?.name ?? "…"}
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Here's what's happening today.
        </p>
      </div>

      {user?.role === "super_admin" ? (
        <AdminDashboardHome />
      ) : (
        <ArtisanDashboardHome />
      )}
    </div>
  );
}
