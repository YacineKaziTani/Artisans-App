import { Link } from "react-router";
import { Hammer } from "lucide-react";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { to: "/categories", label: "Categories" },
      { to: "/products", label: "Products" },
      { to: "/cart", label: "Cart" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/login", label: "Log in" },
      { to: "/register", label: "Create account" },
      { to: "/favorites", label: "Favorites" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/terms", label: "Terms of Service" },
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/refund-policy", label: "Refund Policy" },
    ],
  },
];

export function MarketplaceFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-card">
      <div className="page-shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="btn-gradient flex size-9 items-center justify-center rounded-xl text-white">
                <Hammer className="size-[18px]" />
              </span>
              <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.02em]">
                Artisan<span className="text-primary">Market</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A marketplace for independent makers — handmade goods, skilled
              services, and payments that only settle once the work is done.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-sans text-xs font-semibold tracking-wider text-foreground uppercase">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Artisan Market</p>
          <p>Made for makers, everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
