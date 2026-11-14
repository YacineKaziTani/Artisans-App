import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import {
  Calendar,
  Flag,
  Hammer,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Scale,
  ScrollText,
  Store,
  Tag,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth.store";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { heading: string; items: NavItem[] };

const ARTISAN_NAV: NavGroup[] = [
  {
    heading: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/profile-artisan", label: "My Shop", icon: Store },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Catalog",
    items: [
      { to: "/dashboard/categories", label: "Categories", icon: Tag },
      { to: "/dashboard/shops", label: "Shops", icon: Store },
      { to: "/dashboard/services", label: "Services", icon: Wrench },
    ],
  },
  {
    heading: "Commerce",
    items: [
      { to: "/dashboard/bookings", label: "Bookings", icon: Calendar },
      { to: "/dashboard/orders", label: "Orders", icon: Package },
    ],
  },
  {
    heading: "Community",
    items: [
      { to: "/dashboard/users", label: "Users", icon: Users },
      { to: "/dashboard/messages", label: "Messages", icon: MessageCircle },
      { to: "/dashboard/reports", label: "Reports", icon: Flag },
      { to: "/dashboard/disputes", label: "Disputes", icon: Scale },
      { to: "/dashboard/audit", label: "Admin log", icon: ScrollText },
    ],
  },
];

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const groups = user?.role === "super_admin" ? ADMIN_NAV : ARTISAN_NAV;

  const sidebar = (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-16 items-center justify-between border-b border-border/70 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="btn-gradient flex size-8 items-center justify-center rounded-lg text-white">
            <Hammer className="size-4" />
          </span>
          <span className="font-display text-base leading-none font-semibold tracking-[-0.02em]">
            Artisan<span className="text-primary">Market</span>
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-100 text-brand-700"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-primary"
                        />
                      )}
                      <Icon className="size-[18px]" />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/70 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {initialsOf(user?.name ?? "?")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name ?? "…"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="size-[18px]" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar (persistent ≥lg, drawer below) ───────────────── */}
      <aside className="hidden w-64 shrink-0 border-r border-border/70 lg:block">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Every control inside either navigates or closes the drawer,
              so one click handler covers dismissal. */}
          <div
            className="absolute inset-y-0 left-0 w-64 border-r border-border/70 shadow-[var(--shadow-lg)]"
            onClick={() => setSidebarOpen(false)}
          >
            {sidebar}
          </div>
        </div>
      )}

      {/* ── Main ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-card px-4 lg:h-14 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="size-[18px]" />
          </Button>
          <span className="font-display text-base font-semibold lg:hidden">
            Dashboard
          </span>
          <ThemeToggle className="ml-auto" />
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
