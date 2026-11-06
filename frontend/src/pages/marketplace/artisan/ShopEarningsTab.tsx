import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { useMyEarnings, useOpenStripeDashboard } from "@/hooks/useShops";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/pricing";
import type { Shop } from "@/types";

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * What the artisan has earned: client payments, the platform commission and
 * what they keep. Stripe's dashboard is the record of the actual payouts.
 */
export function ShopEarningsTab({ shop }: { shop: Shop }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useMyEarnings(page);
  const openDashboard = useOpenStripeDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data
            ? `Amounts clients paid, less the ${data.commissionPercent}% platform commission.`
            : "Amounts clients paid, less the platform commission."}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!shop.stripeOnboardingComplete || openDashboard.isPending}
          onClick={() => openDashboard.mutate()}
          title={shop.stripeOnboardingComplete ? undefined : "Set up payouts first (Profile tab)"}
        >
          <ExternalLink className="size-4" />
          {openDashboard.isPending ? "Opening…" : "Payouts & bank details (Stripe)"}
        </Button>
      </div>
      {openDashboard.isError && (
        <p className="alert-error">{getErrorMessage(openDashboard.error)}</p>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      )}
      {isError && <p className="alert-error">{getErrorMessage(error, "Couldn't load your earnings.")}</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="You've earned" value={formatMoney(data.totals.paidNet)} hint={`From ${formatMoney(data.totals.paidGross)} in sales`} />
            <Figure label="This month" value={formatMoney(data.totals.thisMonthNet)} hint={`From ${formatMoney(data.totals.thisMonthGross)} in sales`} />
            <Figure label="On hold" value={formatMoney(data.totals.onHold)} hint="Charged when you fulfil or confirm" />
            <Figure label="Refunded" value={formatMoney(data.totals.refunded)} />
          </div>

          {data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet — they'll appear here as clients pay.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Sale</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 text-right font-medium">Paid</th>
                    <th className="px-3 py-2 text-right font-medium">You keep</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {new Date(row.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{row.kind}</span>{" "}
                        {row.title}
                        {row.deliveryFee > 0 && (
                          <span className="text-xs text-muted-foreground"> (incl. {formatMoney(row.deliveryFee)} delivery)</span>
                        )}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={row.paymentStatus} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.amount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.net === null ? <span className="text-muted-foreground">—</span> : formatMoney(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination meta={data.meta} onPageChange={setPage} disabled={isFetching} />
        </>
      )}
    </div>
  );
}
