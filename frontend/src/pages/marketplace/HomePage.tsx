import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  Compass,
  HandHeart,
  Hammer,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { FeaturedProductsSection } from "@/components/FeaturedProductsSection";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { themeForCategory } from "@/lib/categoryTheme";

const STEPS = [
  {
    icon: Compass,
    title: "Find",
    body: "Browse by craft or search for the exact skill your project needs.",
  },
  {
    icon: HandHeart,
    title: "Connect",
    body: "Message the maker directly, agree the details, and book with confidence.",
  },
  {
    icon: ShieldCheck,
    title: "Complete",
    body: "Your card is only charged once the artisan fulfils the work.",
  },
];

const TRUST = [
  { label: "Independent makers", value: "Verified shops" },
  { label: "Payments", value: "Held until delivery" },
  { label: "Support", value: "Disputes reviewed" },
];

function HeroSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/categories?search=${encodeURIComponent(q)}` : "/categories");
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--shadow-md)] transition-shadow focus-within:shadow-[var(--shadow-lg)]">
        <Search className="ml-2 size-[18px] shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search makers, crafts or services…"
          aria-label="Search artisans and services"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
        />
        <Button type="submit" variant="gradient" className="shrink-0">
          Search
        </Button>
      </div>
    </form>
  );
}

function CategoryStrip() {
  const { data: categories, isLoading } = useCategories();
  const shown = (categories ?? []).slice(0, 8);

  if (!isLoading && shown.length === 0) return null;

  return (
    <section className="page-shell pb-4">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Crafts</span>
          <h2 className="section-title mt-3">Browse by trade</h2>
        </div>
        <Link
          to="/categories"
          className="hidden items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:inline-flex"
        >
          All categories <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))
          : shown.map((category) => {
              const theme = themeForCategory(category.id);
              return (
                <Link
                  key={category.id}
                  to={`/category/${category.id}`}
                  className="surface-lift group flex items-center gap-3 p-4"
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl ${theme.chip}`}
                  >
                    {category.iconUrl?.startsWith("http") ? (
                      <img
                        src={category.iconUrl}
                        alt=""
                        className="size-6 object-contain"
                      />
                    ) : (
                      (category.iconUrl ?? theme.fallbackIcon)
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {category.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      View artisans
                    </span>
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main>
      {/* ══ Hero ══════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden">
        <div className="aurora" aria-hidden="true" />
        <div className="grid-lines" aria-hidden="true" />

        <div className="page-shell relative py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow animate-fade-in">
              <Sparkles className="size-3.5 text-primary" />
              Handmade, not mass produced
            </span>

            <h1 className="mt-6 animate-fade-up font-display text-5xl leading-[1.05] font-semibold text-balance sm:text-6xl lg:text-7xl">
              Connect with{" "}
              <span className="text-gradient">skilled artisans</span> near you
            </h1>

            <p className="mx-auto mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-pretty text-muted-foreground">
              Discover exceptional craftsmanship. Find the right maker for your
              project, browse curated goods, and book directly — no middlemen.
            </p>

            <HeroSearch />

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="gradient">
                <Link to="/categories">
                  Find an artisan <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/register?type=artisan">
                  <Store className="size-4" /> Start your shop
                </Link>
              </Button>
            </div>
          </div>

          {/* Trust strip */}
          <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {TRUST.map((item) => (
              <div
                key={item.label}
                className="surface px-5 py-4 text-center sm:text-left"
              >
                <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {item.label}
                </dt>
                <dd className="mt-1 font-display text-lg font-semibold">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CategoryStrip />

      <FeaturedProductsSection />

      {/* ══ How it works ══════════════════════════════════════════ */}
      <section className="page-shell py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="section-title mt-4">
            From first look to finished work
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three steps, and the money stays protected the whole way through.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <div key={title} className="surface-lift relative p-7">
              <span className="absolute top-6 right-6 font-display text-5xl leading-none font-semibold text-foreground/[0.06]">
                {index + 1}
              </span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Seller CTA ════════════════════════════════════════════ */}
      <section className="page-shell pb-8">
        <div className="relative isolate overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-14 text-center shadow-[var(--shadow-md)] sm:px-14">
          <div className="aurora opacity-70" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 mx-auto">
              <Hammer className="size-5" />
            </span>
            <h2 className="section-title mt-6">Do you make things?</h2>
            <p className="mt-3 text-lg text-pretty text-muted-foreground">
              Open a shop, list your services and products, and get paid
              securely when each job is done.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="gradient">
                <Link to="/register?type=artisan">
                  Open your shop <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/products">Browse the market</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
