import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { ShoppingBag, Store } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/AuthShell";
import { useRegister } from "@/hooks/useAuth";

const ROLES = [
  {
    value: "client",
    label: "I'm buying",
    hint: "Book artisans and order goods",
    icon: ShoppingBag,
  },
  {
    value: "artisan",
    label: "I'm making",
    hint: "Open a shop and sell your work",
    icon: Store,
  },
] as const;

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type");
  const location = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [userType, setUserType] = useState<"client" | "artisan">(
    initialType === "artisan" ? "artisan" : "client",
  );
  const [acceptTerms, setAcceptTerms] = useState(false);

  const { mutate: register, isPending, error } = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register({ name, email, password, phone, role: userType, acceptTerms });
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join the marketplace in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-primary hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="alert-error">
            {getErrorMessage(error, "Registration failed")}
          </p>
        )}

        {/* ── Role picker ────────────────────────────────────────── */}
        <fieldset>
          <legend className="field-label">I'm joining as…</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(({ value, label, hint, icon: Icon }) => {
              const active = userType === value;
              return (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
                    active
                      ? "border-primary bg-brand-50 shadow-[var(--shadow-xs)]"
                      : "border-border hover:border-primary/40 hover:bg-accent/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={active}
                    onChange={() => setUserType(value)}
                    className="sr-only"
                  />
                  <Icon
                    className={`size-[18px] ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="mt-2.5 block text-sm font-semibold">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {hint}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="name" className="field-label">
            Full name
          </label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Jane Doe"
          />
        </div>

        <div>
          <label htmlFor="email" className="field-label">
            Email
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
          <label htmlFor="phone" className="field-label">
            Phone number
          </label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="+1 234 567 8900"
          />
        </div>

        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span className="text-sm leading-relaxed text-muted-foreground">
            I agree to the{" "}
            <Link to="/terms" target="_blank" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          disabled={isPending || !acceptTerms}
          className="w-full"
        >
          {isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
