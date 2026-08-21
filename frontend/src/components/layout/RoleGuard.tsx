import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types";

export function RoleGuard({
  roles,
  redirectTo = "/",
}: {
  roles: User["role"][];
  redirectTo?: string;
}) {
  const user = useAuthStore((s) => s.user);

  if (!user || !roles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
