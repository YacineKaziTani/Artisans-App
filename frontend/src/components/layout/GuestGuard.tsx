import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/store/auth.store'
import { homePathFor, returnPathFrom } from '@/lib/redirects'

export function GuestGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (isAuthenticated) {
    return (
      <Navigate to={returnPathFrom(location.state) ?? homePathFor(user)} replace />
    )
  }

  return <Outlet />
}
