import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import { useMyShopStats } from "@/hooks/useShops";
import { hasOpeningHours } from "@/lib/schedule";
import type { Shop } from "@/types";

interface Step {
  label: string;
  done: boolean;
  to: string;
  /** Not something the artisan can do themselves (e.g. admin approval). */
  waiting?: boolean;
}

/**
 * Walks a new artisan to a shop that can actually sell: details, a first
 * listing, hours, photos, payouts, approval. Disappears once it's all done.
 */
export function ShopSetupChecklist({ shop }: { shop: Shop }) {
  const { data: stats } = useMyShopStats();
  if (!stats) return null;

  const listings = stats.productCount + stats.serviceCount;
  const steps: Step[] = [
    {
      label: "Add a logo and a description",
      done: Boolean(shop.logoUrl && shop.description),
      to: "/profile-artisan",
    },
    {
      label: "List your first product or service",
      done: listings > 0,
      to: stats.serviceCount > 0 ? "/profile-artisan?tab=services" : "/profile-artisan?tab=products",
    },
    ...(stats.serviceCount > 0
      ? [{ label: "Set your opening hours", done: hasOpeningHours(shop.openingHours), to: "/profile-artisan?tab=services" }]
      : []),
    {
      label: "Add photos of your work",
      done: (shop.photos?.length ?? 0) > 0,
      to: "/profile-artisan?tab=photos",
    },
    {
      label: "Set up payouts with Stripe",
      done: stats.acceptsPayments,
      to: "/profile-artisan",
    },
    {
      label: stats.status === "active" ? "Shop approved" : "Approval by our team",
      done: stats.status === "active",
      to: "/profile-artisan",
      waiting: stats.status === "pending",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section className="surface p-6" aria-labelledby="setup-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-title" className="font-display text-lg font-semibold">Get your shop ready to sell</h2>
        <span className="text-sm text-muted-foreground">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-4 space-y-1">
        {steps.map((step) => (
          <li key={step.label}>
            {step.done ? (
              <span className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-[18px] text-jade-500" aria-hidden="true" />
                <span className="line-through">{step.label}</span>
                <span className="sr-only">(done)</span>
              </span>
            ) : step.waiting ? (
              <span className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
                <Clock className="size-[18px] text-warning" aria-hidden="true" />
                {step.label}
                <span className="text-xs text-muted-foreground">— usually within a day of your request</span>
              </span>
            ) : (
              <Link
                to={step.to}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium hover:bg-accent"
              >
                <Circle className="size-[18px] text-muted-foreground" aria-hidden="true" />
                {step.label}
                <ArrowRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
