import type { Location } from "react-router";
import type { User } from "@/types";

/** Where a user lands by default after signing in. */
export function homePathFor(user: Pick<User, "role"> | null | undefined) {
  if (user?.role === "artisan" || user?.role === "super_admin") return "/dashboard";
  return "/";
}

/**
 * The page to return to after login, from AuthGuard's `state.from` (or a
 * link's `state.from`). Only same-app paths are accepted, and auth pages
 * themselves are skipped.
 */
export function returnPathFrom(state: unknown): string | null {
  const from = (state as { from?: Partial<Location> | string } | null)?.from;
  const path =
    typeof from === "string"
      ? from
      : from?.pathname
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : null;
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  if (/^\/(login|register|forgot-password|reset-password)\b/.test(path)) return null;
  return path;
}
