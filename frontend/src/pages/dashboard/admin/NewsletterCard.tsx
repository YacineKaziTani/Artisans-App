import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newsletterApi } from "@/api/newsletter.api";
import { getErrorMessage } from "@/lib/errors";

/**
 * Newsletter subscribers (confirmed via the emailed link) and a CSV export
 * to import into an email tool — the CSV includes each one's unsubscribe link.
 */
export function NewsletterCard() {
  const stats = useQuery({ queryKey: ["admin", "newsletter"], queryFn: newsletterApi.stats });
  const download = useMutation({
    mutationFn: newsletterApi.exportCsv,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <section className="surface flex flex-wrap items-center justify-between gap-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Mail className="size-[18px] text-muted-foreground" aria-hidden="true" /> Newsletter
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.data
            ? `${stats.data.subscribed} confirmed subscriber${stats.data.subscribed === 1 ? "" : "s"}${
                stats.data.pending ? ` · ${stats.data.pending} waiting to confirm` : ""
              }`
            : stats.isError
              ? getErrorMessage(stats.error, "Couldn't load subscribers.")
              : "Loading…"}
        </p>
        {download.isError && (
          <p className="mt-1 text-sm text-destructive">{getErrorMessage(download.error, "The export failed.")}</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={download.isPending || !stats.data?.subscribed}
        onClick={() => download.mutate()}
      >
        <Download className="size-4" /> {download.isPending ? "Preparing…" : "Export CSV"}
      </Button>
    </section>
  );
}
