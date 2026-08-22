import { lazy } from "react";

export const HomePage = lazy(() => import("@/pages/marketplace/HomePage"));
export const CategoriesPage = lazy(
  () => import("@/pages/marketplace/CategoriesPage"),
);
export const CategoryDetailPage = lazy(
  () => import("@/pages/marketplace/CategoryDetailPage"),
);
export const ArtisanShopPage = lazy(
  () => import("@/pages/marketplace/ArtisanShopPage"),
);
export const CartPage = lazy(() => import("@/pages/marketplace/CartPage"));
export const MessagesLayout = lazy(
  () => import("@/pages/messages/MessagesLayout"),
);
export const MessagesEmptyPage = lazy(
  () => import("@/pages/messages/MessagesEmptyPage"),
);
export const MessageThreadPage = lazy(
  () => import("@/pages/messages/MessageThreadPage"),
);
export const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
export const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
export const RefundPolicyPage = lazy(
  () => import("@/pages/legal/RefundPolicyPage"),
);
export const ClientProfilePage = lazy(
  () => import("@/pages/marketplace/ClientProfilePage"),
);
export const ArtisanProfilePage = lazy(
  () => import("@/pages/marketplace/ArtisanProfilePage"),
);
export const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
export const ForgotPasswordPage = lazy(
  () => import("@/pages/auth/ForgotPasswordPage"),
);
export const ResetPasswordPage = lazy(
  () => import("@/pages/auth/ResetPasswordPage"),
);
export const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
export const DashboardPage = lazy(
  () => import("@/pages/dashboard/DashboardPage"),
);
export const AdminCategoriesPage = lazy(
  () => import("@/pages/dashboard/admin/AdminCategoriesPage"),
);
export const AdminUsersPage = lazy(
  () => import("@/pages/dashboard/admin/AdminUsersPage"),
);
export const AdminShopsPage = lazy(
  () => import("@/pages/dashboard/admin/AdminShopsPage"),
);
export const AdminServicesPage = lazy(
  () => import("@/pages/dashboard/admin/AdminServicesPage"),
);
export const AdminBookingsPage = lazy(
  () => import("@/pages/dashboard/admin/AdminBookingsPage"),
);
export const AdminOrdersPage = lazy(
  () => import("@/pages/dashboard/admin/AdminOrdersPage"),
);
export const AdminConversationsPage = lazy(
  () => import("@/pages/dashboard/admin/AdminConversationsPage"),
);
export const AdminConversationThreadPage = lazy(
  () => import("@/pages/dashboard/admin/AdminConversationThreadPage"),
);
export const AdminReportsPage = lazy(
  () => import("@/pages/dashboard/admin/AdminReportsPage"),
);
export const AdminDisputesPage = lazy(
  () => import("@/pages/dashboard/admin/AdminDisputesPage"),
);
export const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
