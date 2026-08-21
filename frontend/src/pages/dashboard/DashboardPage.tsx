import { Link } from "react-router";
import { useAuthStore } from "@/store/auth.store";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAdminShops } from "@/hooks/useAdminShops";
import { useMyShop } from "@/hooks/useShops";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
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
        <StatCard label="Categories" value={categories?.length ?? "—"} />
        <StatCard label="Users" value={users?.length ?? "—"} />
        <StatCard label="Shops" value={shopsPage?.meta.total ?? "—"} />
        <StatCard label="Pending Approval" value={pendingShops} />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm space-y-3">
        <h2 className="font-semibold">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/dashboard/categories" className="text-sm text-[var(--color-primary)] hover:underline">
            Manage Categories
          </Link>
          <Link to="/dashboard/users" className="text-sm text-[var(--color-primary)] hover:underline">
            Manage Users
          </Link>
          <Link to="/dashboard/shops" className="text-sm text-[var(--color-primary)] hover:underline">
            Manage Shops
          </Link>
          <Link to="/dashboard/services" className="text-sm text-[var(--color-primary)] hover:underline">
            Moderate Services
          </Link>
          <Link to="/dashboard/bookings" className="text-sm text-[var(--color-primary)] hover:underline">
            View Bookings
          </Link>
        </div>
      </div>
    </div>
  );
}

function ArtisanDashboardHome() {
  const { data: shop, isLoading } = useMyShop();

  return (
    <div className="space-y-6">
      {!isLoading && !shop && (
        <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-6">
          <h2 className="font-semibold text-orange-900">You don't have a shop yet</h2>
          <p className="mt-1 text-sm text-orange-800">
            Create your shop to start listing services and products.
          </p>
          <Link
            to="/profile-artisan"
            className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline"
          >
            Create your shop →
          </Link>
        </div>
      )}

      {!isLoading && shop && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Services" value={shop.services?.length ?? 0} />
          <StatCard label="Photos" value={shop.photos?.length ?? 0} />
          <StatCard
            label="Shop Status"
            value={shop.status.charAt(0).toUpperCase() + shop.status.slice(1)}
          />
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm space-y-2">
        <h2 className="font-semibold">Manage Your Shop</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Edit your shop profile, add services and products, upload photos, and
          manage bookings.
        </p>
        <Link
          to="/profile-artisan"
          className="inline-block text-sm text-[var(--color-primary)] hover:underline"
        >
          Go to My Shop →
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hello, {user?.name ?? "…"} 👋</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Here's what's happening today.
        </p>
      </div>

      {user?.role === "super_admin" ? <AdminDashboardHome /> : <ArtisanDashboardHome />}
    </div>
  );
}
