import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/AuthShell";
import { useLogin, useLoginSecondStep } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Carries the page to return to (set by AuthGuard / LoginLink) over to
  // the register page too.
  const location = useLocation();
  // e.g. "Password changed — please log in…" after a password change.
  const notice = (location.state as { notice?: string } | null)?.notice;

  const { mutate: login, isPending, error, data, reset } = useLogin();
  const secondStep = useLoginSecondStep();
  const [code, setCode] = useState("");
  const challenge = data?.twoFactorRequired ? data.challenge : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  if (challenge) {
    return (
      <AuthShell title="Two-step login" subtitle="Enter the 6-digit code from your authenticator app.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            secondStep.mutate({ challenge, code: code.trim() });
          }}
          className="space-y-5"
        >
          {secondStep.isError && (
            <p className="alert-error">{getErrorMessage(secondStep.error, "That code didn't work.")}</p>
          )}
          <div>
            <label htmlFor="otp" className="field-label">Code</label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={9}
              required
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Lost your phone? Enter one of your recovery codes (like abcd-efgh) instead.
            </p>
          </div>
          <Button type="submit" variant="gradient" size="lg" disabled={secondStep.isPending} className="w-full">
            {secondStep.isPending ? "Checking…" : "Verify and sign in"}
          </Button>
          <button
            type="button"
            onClick={() => {
              reset();
              secondStep.reset();
              setCode("");
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Back
          </button>
        </form>
      </AuthShell>
    );
  }

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
