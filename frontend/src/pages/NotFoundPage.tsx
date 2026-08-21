import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-7xl font-bold text-[var(--color-primary)]">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-[var(--color-muted)]">The page you're looking for doesn't exist.</p>
      <Link to="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  )
}
