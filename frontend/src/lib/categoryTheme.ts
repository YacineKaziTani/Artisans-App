export interface CategoryTheme {
  /** Icon tile — background + foreground, already paired for contrast. */
  chip: string;
  /** Very light wash for hero panels behind a category. */
  wash: string;
  /** Hairline border that matches the wash. */
  ring: string;
  /** Accent text colour for headings inside a themed panel. */
  text: string;
  fallbackIcon: string;
}

/* Muted, low-saturation pairs. They read as a family rather than eight
   unrelated brand colours, and each one holds up in dark mode. */
const THEMES: CategoryTheme[] = [
  {
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    wash: "from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30",
    ring: "border-amber-200/70 dark:border-amber-900/60",
    text: "text-amber-900 dark:text-amber-100",
    fallbackIcon: "🪵",
  },
  {
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    wash: "from-sky-50 to-cyan-50 dark:from-sky-950/40 dark:to-cyan-950/30",
    ring: "border-sky-200/70 dark:border-sky-900/60",
    text: "text-sky-900 dark:text-sky-100",
    fallbackIcon: "🔧",
  },
  {
    chip: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
    wash: "from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/30",
    ring: "border-yellow-200/70 dark:border-yellow-900/60",
    text: "text-yellow-900 dark:text-yellow-100",
    fallbackIcon: "⚡",
  },
  {
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    wash: "from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/30",
    ring: "border-violet-200/70 dark:border-violet-900/60",
    text: "text-violet-900 dark:text-violet-100",
    fallbackIcon: "🎨",
  },
  {
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    wash: "from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/30",
    ring: "border-rose-200/70 dark:border-rose-900/60",
    text: "text-rose-900 dark:text-rose-100",
    fallbackIcon: "🔥",
  },
  {
    chip: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
    wash: "from-stone-50 to-amber-50 dark:from-stone-900/60 dark:to-amber-950/30",
    ring: "border-stone-300/70 dark:border-stone-700",
    text: "text-stone-900 dark:text-stone-100",
    fallbackIcon: "🧱",
  },
  {
    chip: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
    wash: "from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/30",
    ring: "border-teal-200/70 dark:border-teal-900/60",
    text: "text-teal-900 dark:text-teal-100",
    fallbackIcon: "❄️",
  },
  {
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    wash: "from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30",
    ring: "border-orange-200/70 dark:border-orange-900/60",
    text: "text-orange-900 dark:text-orange-100",
    fallbackIcon: "🏠",
  },
];

export function themeForCategory(id: string): CategoryTheme {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return THEMES[hash % THEMES.length];
}
