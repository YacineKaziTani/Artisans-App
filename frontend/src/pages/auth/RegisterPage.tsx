import { useState } from "react";
import { Link } from "react-router";
import { useRegister } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const register = useRegister();
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(form);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-3xl font-bold text-[var(--color-primary)]">
            ⬡ Artisans App
          </span>
          <h1 className="mt-3 text-2xl font-semibold">Create an account</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Start your journey today
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm space-y-4"
        >
          {register.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-[var(--color-danger)]">
              {(register.error as any)?.response?.data?.message ??
                "Registration failed"}
            </div>
          )}

          <Input
            label="Full name"
            placeholder="John Doe"
            value={form.name}
            onChange={set("name")}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
          />

          <Button type="submit" className="w-full" loading={register.isPending}>
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
