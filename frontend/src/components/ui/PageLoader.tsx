/** Full-bleed loading state used while a route chunk or the session resolves. */
export function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
      <span className="relative flex size-10 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="size-10 animate-spin rounded-full border-[3px] border-border border-t-primary" />
      </span>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
