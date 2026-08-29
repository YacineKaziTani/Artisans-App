import { Link } from "react-router";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="aurora opacity-60" aria-hidden="true" />
      <div className="grid-lines" aria-hidden="true" />

      <div className="relative max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Compass className="size-6" />
        </span>
        <p className="mt-8 font-display text-7xl font-semibold text-gradient">
          404
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold">
          Page not found
        </h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient">
            <Link to="/">
              <ArrowLeft className="size-4" /> Back to marketplace
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/categories">Browse categories</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
