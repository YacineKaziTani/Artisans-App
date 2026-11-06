import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/types";

/**
 * Previous / "Page x of y" / Next. Renders nothing for a single page, so
 * lists can always include it.
 */
export function Pagination({
  meta,
  onPageChange,
  disabled,
  className = "",
}: {
  meta: PageMeta | undefined;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!meta || meta.lastPage <= 1) return null;
  const { page, lastPage, total } = meta;

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between gap-3 pt-2 ${className}`}
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {lastPage}
        <span className="hidden sm:inline"> · {total} total</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
