export interface CategoryTheme {
  bg: string;
  gradient: string;
  border: string;
  text: string;
  fallbackIcon: string;
}

const THEMES: CategoryTheme[] = [
  { bg: "from-amber-50", gradient: "from-amber-100 to-orange-100", border: "border-amber-300", text: "text-amber-900", fallbackIcon: "🪵" },
  { bg: "from-blue-50", gradient: "from-blue-100 to-cyan-100", border: "border-blue-300", text: "text-blue-900", fallbackIcon: "🔧" },
  { bg: "from-yellow-50", gradient: "from-yellow-100 to-orange-100", border: "border-yellow-300", text: "text-yellow-900", fallbackIcon: "⚡" },
  { bg: "from-purple-50", gradient: "from-purple-100 to-pink-100", border: "border-purple-300", text: "text-purple-900", fallbackIcon: "🎨" },
  { bg: "from-red-50", gradient: "from-red-100 to-orange-100", border: "border-red-300", text: "text-red-900", fallbackIcon: "🔥" },
  { bg: "from-stone-50", gradient: "from-stone-100 to-orange-100", border: "border-stone-300", text: "text-stone-900", fallbackIcon: "🧱" },
  { bg: "from-slate-50", gradient: "from-slate-100 to-blue-100", border: "border-slate-300", text: "text-slate-900", fallbackIcon: "❄️" },
  { bg: "from-orange-50", gradient: "from-orange-100 to-amber-100", border: "border-orange-300", text: "text-orange-900", fallbackIcon: "🏠" },
];

/** Stable theme per category id, so the same category always looks the same. */
export function themeForCategory(id: string): CategoryTheme {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return THEMES[hash % THEMES.length];
}
