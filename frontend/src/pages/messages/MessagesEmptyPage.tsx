import { Link } from "react-router";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MessagesEmptyPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MessagesSquare className="size-6" />
      </span>
      <p className="font-display text-lg font-semibold">Your messages</p>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        Pick a conversation on the left to read it, or start a new one from an
        artisan's shop page.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link to="/categories">Browse artisans</Link>
      </Button>
    </div>
  );
}
