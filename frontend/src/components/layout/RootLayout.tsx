import { useMe } from "@/hooks/useAuth";
import { Outlet } from "react-router";
import { PageLoader } from "../ui/PageLoader";
import { useSocketConnection } from "@/hooks/useSocketConnection";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

export function RootLayout() {
  const { isLoading } = useMe();
  useSocketConnection();
  if (isLoading) return <PageLoader />;
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <EmailVerificationBanner />
      <Outlet />
    </div>
  );
}
