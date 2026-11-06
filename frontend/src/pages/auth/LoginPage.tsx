import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/AuthShell";
import { useLogin } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Carries the page to return to (set by AuthGuard / LoginLink) over to
  // the register page too.
  const location = useLocation();
  // e.g. "Password changed — please log in…" after a password change.
  const notice = (location.state as { notice?: string } | null)?.notice;

  const { mutate: login, isPending, error } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Artisan Market account."
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to="/register"
            state={location.state}
            className="font-semibold text-primary hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {notice && !error && (
          <p className="rounded-lg border border-jade-500/25 bg-jade-50 p-3 text-sm text-jade-600">
            {notice}
          </p>
        )}
        {error && (
          <p className="alert-error">{getErrorMessage(error, "Login failed")}</p>
        )}

        <div>
          <label htmlFor="email" className="field-label">
            Email address
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="mb-1.5 text-sm text-muted-foreground hover:text-primary"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
