import { lazy } from "react";

export const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
export const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
export const DashboardPage = lazy(
  () => import("@/pages/dashboard/DashboardPage"),
);
export const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
