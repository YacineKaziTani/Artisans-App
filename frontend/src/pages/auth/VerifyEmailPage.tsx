import { Link, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/AuthShell";
import { useVerifyEmail } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth.store";
import { homePathFor } from "@/lib/redirects";
import { getErrorMessage } from "@/lib/errors";

/** Where the link in the confirmation email lands. */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const user = useAuthStore((s) => s.user);
  const { isPending, isSuccess, isError, error } = useVerifyEmail(token);

  const next = user ? homePathFor(user) : "/login";
  const nextLabel = user ? "Continue" : "Sign in";

  return (
    <AuthShell
      title="Confirm your email"
      subtitle="One click and you can buy, book and message artisans."
      footer={
        <Link to="/" className="font-semibold text-primary hover:underline">
          Back to the marketplace
        </Link>
      }
    >
      {!token && (
        <p className="alert-error">
          This link is incomplete. Open the link from the email again, or send a new one
          from the banner at the top of the page after signing in.
        </p>
      )}

      {token && isPending && (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-20" />
          <p className="text-sm text-muted-foreground">Confirming your email…</p>
        </div>
      )}

      {isSuccess && (
        <div className="space-y-5">
          <div className="surface flex gap-4 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-jade-50 text-jade-500">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your email is confirmed — you're all set.
            </p>
          </div>
          <Button asChild variant="gradient" size="lg" className="w-full">
            <Link to={next}>{nextLabel}</Link>
          </Button>
        </div>
      )}

      {isError && (
        <div className="space-y-5">
          <p className="alert-error">
            {getErrorMessage(error, "We couldn't confirm your email with this link.")}
          </p>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to={next}>{nextLabel}</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
