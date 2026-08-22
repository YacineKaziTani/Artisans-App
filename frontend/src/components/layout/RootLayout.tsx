import { useMe } from "@/hooks/useAuth";
import { Outlet } from "react-router";
import { PageLoader } from "../ui/PageLoader";
import { useSocketConnection } from "@/hooks/useSocketConnection";

export function RootLayout() {
  const { isLoading } = useMe();
  useSocketConnection();
  if (isLoading) return <PageLoader />;
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
      <Outlet />
    </div>
  );
}
