import { Outlet } from 'react-router'

export function RootLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
      <Outlet />
    </div>
  )
}
