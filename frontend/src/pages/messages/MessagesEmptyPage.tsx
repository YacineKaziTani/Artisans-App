import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function MessagesEmptyPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <span
        className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl"
        aria-hidden="true"
      >
        💬
      </span>
      <p className="font-medium text-foreground">Your messages</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Pick a conversation on the left to read it, or start a new one from an
        artisan's shop page.
      </p>
      <Link to="/categories" className="mt-1">
        <Button variant="outline" size="sm">
          Browse artisans
        </Button>
      </Link>
    </div>
  );
}
