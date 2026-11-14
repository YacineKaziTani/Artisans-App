import type { LucideIcon } from "lucide-react";

/**
 * The one page title style: display font, optional icon tile and actions
 * on the right. Dashboard and account pages all use it so the app reads
 * as one product.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className = "",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold text-balance">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
