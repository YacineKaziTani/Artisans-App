import { useState } from "react";
import { Link, NavLink } from "react-router";
import {
  Hammer,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  ShoppingBag,
  Store,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useLogout } from "@/hooks/useAuth";
import { useMyConversations } from "@/hooks/useConversations";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/categories", label: "Categories", end: false },
  { to: "/products", label: "Products", end: false },
];

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Small count bubble anchored to the corner of an icon button. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground shadow-[var(--shadow-sm)] ring-2 ring-card">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function MarketplaceNavbar() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  const cartCount = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.quantity, 0),
  );
  const { data: conversations } = useMyConversations({
    enabled: isAuthenticated,
  });
  const unreadMessages = isAuthenticated
    ? (conversations ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
    : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 glass">
      <nav className="page-shell">
        <div className="flex h-16 items-center justify-between gap-4 lg:h-18">
          {/* ── Brand + primary links ─────────────────────────────── */}
          <div className="flex items-center gap-8">
            <Link to="/" className="group flex items-center gap-2.5">
              <span className="btn-gradient flex size-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-sm)] transition-transform duration-300 group-hover:-rotate-6">
                <Hammer className="size-[18px]" />
              </span>
              <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.02em]">
                Artisan<span className="text-primary">Market</span>
              </span>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAuthenticated && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative hidden sm:inline-flex"
                aria-label={`Messages${unreadMessages ? `, ${unreadMessages} unread` : ""}`}
              >
                <Link to="/messages">
                  <MessageCircle className="size-[18px]" />
                  <CountBadge count={unreadMessages} />
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
            >
              <Link to="/cart">
                <ShoppingBag className="size-[18px]" />
                <CountBadge count={cartCount} />
              </Link>
            </Button>

            {!isAuthenticated && (
              <div className="hidden items-center gap-2 sm:flex">
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild variant="gradient" size="sm">
                  <Link to="/register">Get started</Link>
                </Button>
              </div>
            )}

            {isAuthenticated && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pr-3 pl-1 text-sm font-medium shadow-[var(--shadow-xs)] transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {initialsOf(user.name)}
                    </span>
                    <span className="hidden max-w-24 truncate sm:inline">
                      {user.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(user.role === "artisan" || user.role === "super_admin") && (
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard">
                        <LayoutDashboard className="size-4" /> Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === "artisan" && (
                    <DropdownMenuItem asChild>
                      <Link to="/profile-artisan">
                        <Store className="size-4" /> My shop
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/profile-client">
                      <User className="size-4" /> My profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/favorites">
                      <Heart className="size-4" /> Favorites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="sm:hidden">
                    <Link to="/messages">
                      <MessageCircle className="size-4" /> Messages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="size-[18px]" />
              ) : (
                <Menu className="size-[18px]" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Mobile sheet ────────────────────────────────────────── */}
      {menuOpen && (
        <div className="border-t border-border/70 bg-card/95 md:hidden">
          {/* Any tap inside navigates or is a no-op, so close on click
              rather than syncing the sheet to the route in an effect. */}
          <div
            className="page-shell space-y-1 py-4"
            onClick={() => setMenuOpen(false)}
          >
            {LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            {!isAuthenticated && (
              <div className="flex gap-2 pt-3">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild variant="gradient" className="flex-1">
                  <Link to="/register">Get started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
