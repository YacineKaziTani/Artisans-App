// Initials avatar for a conversation party. There's no uploaded avatar on
// shops and most users, so the colour is derived from the name — stable per
// person, so the same contact is always the same colour in the list and in
// the thread header.
const PALETTE = [
  "bg-orange-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-600",
  "bg-indigo-500",
  "bg-emerald-600",
  "bg-fuchsia-500",
  "bg-sky-600",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function PartyAvatar({
  name,
  size = "md",
  className = "",
}: {
  name?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const label = name?.trim() || "Conversation";
  const dimensions = size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";

  return (
    <span
      aria-hidden="true"
      className={`${dimensions} ${colorFor(label)} ${className} flex-shrink-0 rounded-full flex items-center justify-center font-semibold text-white select-none`}
    >
      {initials(label)}
    </span>
  );
}
