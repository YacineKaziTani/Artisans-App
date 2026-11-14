import { Link } from "react-router";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastTone } from "@/lib/toast";

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const ICON_TONE: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
};

/**
 * Where toasts appear: bottom-centre on phones (above the sticky buy bars'
 * reach is handled by their own spacing), bottom-right on larger screens.
 * Errors are announced assertively, the rest politely.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-card-foreground shadow-[var(--shadow-lg)]"
          >
            <Icon className={`mt-0.5 size-5 shrink-0 ${ICON_TONE[t.tone]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
              {t.action && (
                <Link
                  to={t.action.href}
                  onClick={() => dismiss(t.id)}
                  className="mt-1.5 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  {t.action.label}
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mt-1 -mr-1 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
