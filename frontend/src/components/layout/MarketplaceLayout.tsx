import { Outlet } from "react-router";
import { MarketplaceNavbar } from "@/components/MarketplaceNavbar";
import { MarketplaceFooter } from "@/components/MarketplaceFooter";

export function MarketplaceLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MarketplaceNavbar />
      <div className="flex-1">
        <Outlet />
      </div>
      <MarketplaceFooter />
    </div>
  );
}
