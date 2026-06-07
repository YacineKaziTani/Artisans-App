import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GuestGuard } from "@/components/layout/GuestGuard";
import { withSuspense } from "@/components/layout/withSuspense";
import {
  LoginPage,
  RegisterPage,
  DashboardPage,
  NotFoundPage,
} from "./lazyPages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // ── Public routes ──────────────────────────────────────────
      {
        element: <GuestGuard />,
        children: [
          { path: "login", element: withSuspense(LoginPage) },
          { path: "register", element: withSuspense(RegisterPage) },
        ],
      },

      // ── Protected routes ───────────────────────────────────────
      {
        element: <AuthGuard />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: "dashboard", element: withSuspense(DashboardPage) },
              // more protected routes here
            ],
          },
        ],
      },

      { path: "*", element: withSuspense(NotFoundPage) },
    ],
  },
]);
