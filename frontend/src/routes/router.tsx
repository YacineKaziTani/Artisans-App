import { createBrowserRouter, Navigate } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { GuestGuard } from '@/components/layout/GuestGuard'

// Pages — lazy loaded for code splitting
import { lazy, Suspense } from 'react'
import { PageLoader } from '@/components/ui/PageLoader'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // ── Public routes ──────────────────────────────────────────
      {
        element: <GuestGuard />,
        children: [
          { path: 'login', element: withSuspense(LoginPage) },
          { path: 'register', element: withSuspense(RegisterPage) },
        ],
      },

      // ── Protected routes ───────────────────────────────────────
      {
        element: <AuthGuard />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: 'dashboard', element: withSuspense(DashboardPage) },
              // 👇 Add more protected routes here
            ],
          },
        ],
      },

      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },
])
