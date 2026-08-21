import { Outlet } from "react-router";
import { MarketplaceNavbar } from "@/components/MarketplaceNavbar";

export function MarketplaceLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketplaceNavbar />
      <Outlet />
    </div>
  );
}
