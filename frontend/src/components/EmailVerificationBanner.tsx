import { MailCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useResendVerification } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/errors";

/**
 * Shown to signed-in users who haven't confirmed their email yet. Until
 * they do, ordering, booking, messaging and posting are refused by the API,
 * so this explains why and offers a fresh link.
 */
export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const resend = useResendVerification();

  // `=== false`: sessions cached before this field existed have it
  // undefined until /auth/me refreshes them — don't flash the banner.
  if (!user || user.emailVerified !== false) return null;

  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10 text-sm">
      <div className="page-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <MailCheck className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Confirm your email to start buying, booking and messaging — we sent a link to{" "}
          <span className="font-semibold">{user.email}</span>.
        </p>
        {resend.isSuccess ? (
          <span className="text-muted-foreground">{resend.data.message}</span>
        ) : (
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {resend.isPending ? "Sending…" : "Send a new link"}
          </button>
        )}
        {resend.isError && (
          <span className="w-full text-destructive">
            {getErrorMessage(resend.error, "Couldn't send the email. Please try again.")}
          </span>
        )}
      </div>
    </div>
  );
}
