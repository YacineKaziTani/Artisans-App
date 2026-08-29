import { Link } from "react-router";
import { ArrowLeft, Hammer, Quote, ShieldCheck, Sparkles } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Handmade, not mass produced",
    body: "Every listing comes from an independent maker with a real workshop.",
  },
  {
    icon: ShieldCheck,
    title: "Payments held safely",
    body: "Your card is only charged once the artisan fulfils the work.",
  },
];

/**
 * Two-pane shell shared by every auth screen: a brand panel that only
 * appears once there is room for it, and the form itself centred on the
 * remaining width.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ──────────────────────────────────────────── */}
      <aside className="relative isolate hidden overflow-hidden border-r border-border/70 bg-muted/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="aurora" aria-hidden="true" />
        <div className="grid-lines" aria-hidden="true" />

        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="btn-gradient flex size-9 items-center justify-center rounded-xl text-white">
            <Hammer className="size-[18px]" />
          </span>
          <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.02em]">
            Artisan<span className="text-primary">Market</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <Quote className="size-8 text-primary/40" />
          <p className="mt-5 font-display text-3xl leading-snug font-semibold text-balance">
            A marketplace built for the people who actually make things.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Artisan Market
        </p>
      </aside>

      {/* ── Form panel ───────────────────────────────────────────── */}
      <main className="flex flex-col px-5 py-8 sm:px-8">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to marketplace
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Link
              to="/"
              className="mb-8 flex items-center gap-2.5 lg:hidden"
              aria-hidden="true"
            >
              <span className="btn-gradient flex size-9 items-center justify-center rounded-xl text-white">
                <Hammer className="size-[18px]" />
              </span>
              <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.02em]">
                Artisan<span className="text-primary">Market</span>
              </span>
            </Link>

            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
              {title}
            </h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>

            <div className="mt-8">{children}</div>

            {footer && (
              <div className="mt-8 border-t border-border/70 pt-6 text-center text-sm text-muted-foreground">
                {footer}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
