import { Link } from "react-router";
import { ArrowRight, CalendarClock, CreditCard, Package, Sparkles, Star, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/PageMeta";

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Package,
    title: "Sell what you make",
    text: "List products with options, photos and stock — or sell made-to-order. Offer pickup, delivery, or both, with your own delivery fee.",
  },
  {
    icon: CalendarClock,
    title: "Take bookings",
    text: "Offer classes, repairs and commissions. Set your opening hours and clients pick a free slot — no back-and-forth.",
  },
  {
    icon: CreditCard,
    title: "Get paid safely",
    text: "Clients' cards are held at checkout and charged when you fulfil the order or confirm the booking. Payouts go straight to your bank through Stripe.",
  },
  {
    icon: Star,
    title: "Build your reputation",
    text: "Clients who bought from you leave reviews, with photos — and you can reply to every one.",
  },
];

const STEPS = [
  "Create a free account as an artisan",
  "Set up your shop: name, story, logo and photos",
  "List your first products or services",
  "Connect payouts with Stripe",
  "We review your shop — usually within a day — and you're live",
];

export default function SellPage() {
  return (
    <main>
      <PageMeta
        title="Sell your craft"
        description="Open a shop on Artisan Market: sell handmade goods, take bookings, and get paid safely. Free to start."
      />

      <section className="relative isolate overflow-hidden border-b border-border/70">
        <div className="aurora opacity-60" aria-hidden="true" />
        <div className="page-shell relative py-16 sm:py-24">
          <span className="eyebrow">For makers</span>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold text-balance sm:text-6xl">
            Your craft deserves a <span className="text-gradient">shop of its own</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Sell handmade goods and take bookings in one place. No monthly fee — you only pay a small commission
            when you make a sale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="gradient">
              <Link to="/register?type=artisan">
                Start selling <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/help">Questions? Read the FAQ</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-shell py-16">
        <h2 className="section-title">Everything you need to sell</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="surface p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/40 py-16">
        <div className="page-shell grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="section-title">Live in five steps</h2>
            <p className="mt-2 text-muted-foreground">
              Your dashboard walks you through each one.
            </p>
          </div>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={step} className="surface flex items-center gap-4 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-shell py-16 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Store className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold">Ready to open your shop?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          It takes a few minutes. You can set everything up before anyone sees it.
        </p>
        <Button asChild size="lg" variant="gradient" className="mt-6">
          <Link to="/register?type=artisan">
            <Sparkles className="size-4" /> Create my shop
          </Link>
        </Button>
      </section>
    </main>
  );
}
