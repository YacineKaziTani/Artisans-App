import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useLogout } from "@/hooks/useAuth";

export function MarketplaceNavbar() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useLogout();
  const cartCount = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.quantity, 0),
  );

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-foreground">
              Artisan Marketplace
            </Link>
            <div className="hidden md:flex gap-6">
              <Link
                to="/"
                className="text-foreground/80 hover:text-foreground"
              >
                Home
              </Link>
              <Link
                to="/categories"
                className="text-foreground/80 hover:text-foreground"
              >
                Categories
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/cart" className="relative">
              <Button variant="outline" size="sm">
                🛒 Cart
              </Button>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            {!isAuthenticated && (
              <div className="flex gap-2">
                <Link to="/login">
                  <Button variant="outline">Login</Button>
                </Link>
                <Link to="/register">
                  <Button>Register</Button>
                </Link>
              </div>
            )}

            {isAuthenticated && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">{user.name}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.role === "artisan" && (
                    <DropdownMenuItem asChild>
                      <Link to="/profile-artisan">My Shop</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/profile-client">My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
