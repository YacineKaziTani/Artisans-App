import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { userApi } from "@/api/user.api";
import { getErrorMessage } from "@/lib/errors";

const PROVIDER_LABELS = { resend: "Resend", smtp: "SMTP", none: "None" } as const;

/**
 * Password resets, sign-up confirmation and order/booking notifications
 * all go by email — this shows whether that's set up to reach real users,
 * and lets an admin send themselves a test on the live site.
 */
export function EmailDeliveryCard() {
  const status = useQuery({ queryKey: ["admin", "email-status"], queryFn: userApi.emailStatus });
  const test = useMutation({ mutationFn: userApi.sendTestEmail });

  return (
    <section className="surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Mail className="size-[18px] text-muted-foreground" aria-hidden="true" /> Email delivery
          </h2>
          {status.data && (
            <p className="mt-1 text-sm text-muted-foreground">
              Provider: {PROVIDER_LABELS[status.data.provider]} · Sender: {status.data.from}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          {test.isPending ? "Sending…" : "Send me a test email"}
        </Button>
      </div>

      {status.isError && (
        <p className="alert-error mt-4">{getErrorMessage(status.error, "Couldn't check email settings.")}</p>
      )}
      {status.data?.problem && (
        <p className="alert-note mt-4 flex gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{status.data.problem}</span>
        </p>
      )}
      {status.data && !status.data.problem && (
        <p className="mt-4 flex items-center gap-2 text-sm text-jade-600">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Set up to reach your users.
        </p>
      )}

      {test.isSuccess && (
        <p className="mt-3 text-sm text-muted-foreground">
          {test.data.sent
            ? `Sent to ${test.data.sentTo} — check that inbox (and its spam folder).`
            : "Nothing was sent: no email provider is configured, so the email was only written to the server log."}
        </p>
      )}
      {test.isError && (
        <p className="alert-error mt-3">
          {getErrorMessage(test.error, "The test email couldn't be sent.")}
        </p>
      )}
    </section>
  );
}
