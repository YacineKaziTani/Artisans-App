import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { newsletterApi } from "@/api/newsletter.api";
import { getErrorMessage } from "@/lib/errors";
import { PageMeta } from "@/components/PageMeta";

/** Lands from the newsletter emails: ?confirm=TOKEN or ?unsubscribe=TOKEN. */
export default function NewsletterPage() {
  const [params] = useSearchParams();
  const confirm = params.get("confirm");
  const unsubscribe = params.get("unsubscribe");
  const token = confirm ?? unsubscribe;
  const action = confirm ? "confirm" : "unsubscribe";

  // A query (not a mutation) so React's dev double-mount sends it once.
  const result = useQuery({
    queryKey: ["newsletter", action, token ?? ""],
    queryFn: () => (confirm ? newsletterApi.confirm(confirm) : newsletterApi.unsubscribe(unsubscribe!)),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <main className="page-shell max-w-xl py-16">
      <PageMeta title="Newsletter" />
      <h1 className="font-display text-3xl font-semibold">Newsletter</h1>
      <div className="mt-6">
        {!token && <p className="alert-error">This link is incomplete — open it from the email again.</p>}
        {token && result.isPending && <div className="skeleton h-16" aria-busy="true" />}
        {result.isSuccess && (
          <div className="surface flex gap-4 p-5">
            <CheckCircle2 className="size-6 shrink-0 text-jade-500" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">{result.data.message}</p>
          </div>
        )}
        {result.isError && <p className="alert-error">{getErrorMessage(result.error, "This link didn't work.")}</p>}
      </div>
      <Link to="/" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
        Back to the marketplace
      </Link>
    </main>
  );
}
