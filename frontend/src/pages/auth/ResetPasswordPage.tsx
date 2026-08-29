import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/AuthShell";
import { authApi } from "@/api/auth.api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const { mutate, isPending, isError, isSuccess } = useMutation({
    mutationFn: () => authApi.resetPassword({ email, token, newPassword }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    mutate();
  };

  const missingLinkParams = !email || !token;

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a password you haven't used before."
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      {missingLinkParams && (
        <p className="alert-error">
          This reset link is invalid. Please request a new one.
        </p>
      )}

      {!missingLinkParams && isSuccess && (
        <div className="space-y-5">
          <div className="surface flex gap-4 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-jade-50 text-jade-500">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your password has been reset. You can sign in with it now.
            </p>
          </div>
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={() => navigate("/login")}
          >
            Go to login
          </Button>
        </div>
      )}

      {!missingLinkParams && !isSuccess && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {isError && (
            <p className="alert-error">
              That link may have expired. Please request a new one.
            </p>
          )}
          {mismatch && <p className="alert-error">Passwords don't match.</p>}

          <div>
            <label htmlFor="new-password" className="field-label">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="field-label">
              Confirm new password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
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
            {isPending ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
