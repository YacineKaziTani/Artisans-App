import { NavLink, Outlet } from 'react-router'
import { useLogout } from '@/hooks/useAuth'
import { useMe } from '@/hooks/useAuth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  // 👇 Add nav items as you build more pages
]

export function DashboardLayout() {
  const { data: user } = useMe()
  const logout = useLogout()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5">
          <span className="text-xl font-bold text-[var(--color-primary)]">⬡ MyApp</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-[var(--color-primary)]'
                    : 'text-[var(--color-muted)] hover:bg-gray-100 hover:text-[var(--color-text)]'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-[var(--color-border)] p-4">
          <p className="truncate text-sm font-medium">{user?.name ?? '…'}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">{user?.email}</p>
          <button
            onClick={() => logout.mutate()}
            className="mt-3 w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:border-red-300 hover:text-[var(--color-danger)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[var(--color-bg)] p-8">
        <Outlet />
      </main>
    </div>
  )
}
