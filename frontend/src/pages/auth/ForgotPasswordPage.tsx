import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/AuthShell";
import { authApi } from "@/api/auth.api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
  });

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      {isSuccess ? (
        <div className="surface flex gap-4 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-jade-50 text-jade-500">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If that email exists, a reset link has been sent. Check your inbox
            — including the spam folder.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
          className="space-y-5"
        >
          {isError && (
            <p className="alert-error">Something went wrong. Please try again.</p>
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
              placeholder="you@example.com"
              required
            />
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
