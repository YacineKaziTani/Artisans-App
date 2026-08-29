import { useMe } from "@/hooks/useAuth";
import { Outlet } from "react-router";
import { PageLoader } from "../ui/PageLoader";
import { useSocketConnection } from "@/hooks/useSocketConnection";

export function RootLayout() {
  const { isLoading } = useMe();
  useSocketConnection();
  if (isLoading) return <PageLoader />;
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Outlet />
    </div>
  );
}
