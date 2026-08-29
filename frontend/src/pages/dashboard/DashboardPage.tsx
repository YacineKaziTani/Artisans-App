import { Link } from "react-router";
import {
  ArrowRight,
  Calendar,
  Camera,
  Clock,
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
import { useMyShop } from "@/hooks/useShops";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: boolean;
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
    </div>
  );
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
  const { data: users } = useAdminUsers();
  const { data: shopsPage } = useAdminShops();

  const pendingShops =
    shopsPage?.data.filter((s) => s.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Categories"
          value={categories?.length ?? "—"}
          icon={Tag}
        />
        <StatCard label="Users" value={users?.length ?? "—"} icon={Users} />
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

      {!isLoading && shop && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Services"
            value={shop.services?.length ?? 0}
            icon={Wrench}
          />
          <StatCard
            label="Photos"
            value={shop.photos?.length ?? 0}
            icon={Camera}
          />
          <StatCard
            label="Shop status"
            value={shop.status.charAt(0).toUpperCase() + shop.status.slice(1)}
            icon={Store}
            accent={shop.status === "active"}
          />
        </div>
      )}

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
