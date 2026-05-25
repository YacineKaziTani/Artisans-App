import { useMe } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { data: user, isLoading } = useMe()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {isLoading ? 'Loading…' : `Hello, ${user?.name} 👋`}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Here's what's happening today.</p>
      </div>

      {/* Stats grid — wire up to real API data as you build */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Total Users', value: '—', change: '' },
          { label: 'Revenue', value: '—', change: '' },
          { label: 'Active Sessions', value: '—', change: '' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          >
            <p className="text-sm text-[var(--color-muted)]">{label}</p>
            <p className="mt-1 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder content card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="font-semibold">Recent Activity</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Connect this section to your Express API using TanStack Query hooks.
        </p>
      </div>
    </div>
  )
}
