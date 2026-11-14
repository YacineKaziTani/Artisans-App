import { formatMoney, onSale } from "@/lib/pricing";

/**
 * A price, with the old price crossed out and a "-20%" tag when the item
 * is on sale.
 */
export function Price({
  amount,
  compareAt,
  className = "",
  size = "md",
}: {
  amount: string | number;
  compareAt?: string | number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sale = onSale(amount, compareAt);
  const main = size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base";
  const percent = sale ? Math.round((1 - Number(amount) / Number(compareAt)) * 100) : 0;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className={`font-display font-semibold ${sale ? "text-destructive" : "text-primary"} ${main}`}>
        {formatMoney(amount)}
      </span>
      {sale && (
        <>
          <s className="text-sm text-muted-foreground">
            <span className="sr-only">was </span>
            {formatMoney(compareAt!)}
          </s>
          {percent > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              -{percent}%
            </span>
          )}
        </>
      )}
    </span>
  );
}
