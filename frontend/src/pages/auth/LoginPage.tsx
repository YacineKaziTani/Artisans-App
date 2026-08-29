import { useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/AuthShell";
import { useLogin } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="alert-error">
            {(axios.isAxiosError(error) && error.response?.data?.message) ||
              "Login failed"}
          </p>
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
