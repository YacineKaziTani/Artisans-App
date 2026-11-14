import { useMe } from "@/hooks/useAuth";
import { Outlet } from "react-router";
import { PageLoader } from "../ui/PageLoader";
import { useSocketConnection } from "@/hooks/useSocketConnection";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { Toaster } from "@/components/Toaster";

export function RootLayout() {
  const { isLoading } = useMe();
  useSocketConnection();
  if (isLoading) return <PageLoader />;
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <EmailVerificationBanner />
      <Outlet />
      {/* Inside the router: toasts can carry a link ("View cart"). */}
      <Toaster />
    </div>
  );
}
