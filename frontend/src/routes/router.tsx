import { createBrowserRouter } from "react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { MarketplaceLayout } from "@/components/layout/MarketplaceLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GuestGuard } from "@/components/layout/GuestGuard";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { withSuspense } from "@/components/layout/withSuspense";
import {
  HomePage,
  CategoriesPage,
  CategoryDetailPage,
  ArtisanShopPage,
  CartPage,
  ClientProfilePage,
  ArtisanProfilePage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  DashboardPage,
  AdminCategoriesPage,
  AdminUsersPage,
  AdminShopsPage,
  AdminServicesPage,
  AdminBookingsPage,
  AdminOrdersPage,
  NotFoundPage,
} from "./lazyPages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // ── Marketplace (public, browsable whether logged in or not) ─
      {
        element: <MarketplaceLayout />,
        children: [
          { index: true, element: withSuspense(HomePage) },
          { path: "categories", element: withSuspense(CategoriesPage) },
          { path: "category/:id", element: withSuspense(CategoryDetailPage) },
          { path: "artisan/:id", element: withSuspense(ArtisanShopPage) },
          { path: "cart", element: withSuspense(CartPage) },
        ],
      },

      // ── Public routes ──────────────────────────────────────────
      {
        element: <GuestGuard />,
        children: [
          { path: "login", element: withSuspense(LoginPage) },
          { path: "register", element: withSuspense(RegisterPage) },
          {
            path: "forgot-password",
            element: withSuspense(ForgotPasswordPage),
          },
          {
            path: "reset-password",
            element: withSuspense(ResetPasswordPage),
          },
        ],
      },

      // ── Protected routes ───────────────────────────────────────
      {
        element: <AuthGuard />,
        children: [
          // Profile pages use the marketplace navbar, not the dashboard shell
          {
            element: <MarketplaceLayout />,
            children: [
              {
                path: "profile-client",
                element: withSuspense(ClientProfilePage),
              },
              {
                path: "profile-artisan",
                element: withSuspense(ArtisanProfilePage),
              },
            ],
          },
          {
            element: <DashboardLayout />,
            children: [
              {
                element: <RoleGuard roles={["artisan", "super_admin"]} />,
                children: [
                  { path: "dashboard", element: withSuspense(DashboardPage) },
                ],
              },
              {
                element: <RoleGuard roles={["super_admin"]} />,
                children: [
                  {
                    path: "dashboard/categories",
                    element: withSuspense(AdminCategoriesPage),
                  },
                  {
                    path: "dashboard/users",
                    element: withSuspense(AdminUsersPage),
                  },
                  {
                    path: "dashboard/shops",
                    element: withSuspense(AdminShopsPage),
                  },
                  {
                    path: "dashboard/services",
                    element: withSuspense(AdminServicesPage),
                  },
                  {
                    path: "dashboard/bookings",
                    element: withSuspense(AdminBookingsPage),
                  },
                  {
                    path: "dashboard/orders",
                    element: withSuspense(AdminOrdersPage),
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: "*", element: withSuspense(NotFoundPage) },
    ],
  },
]);
