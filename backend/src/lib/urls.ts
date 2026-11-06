// FRONTEND_URL may list several origins (comma-separated) for CORS, e.g. the
// production domain plus Vercel previews.

export function allowedOrigins(): string[] {
  const origins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return origins.length ? origins : ["http://localhost:5173"];
}

/**
 * Whether a browser request's Origin header is one of our frontends. A
 * missing Origin is allowed: browsers always send one on cross-site
 * requests (and on every POST/PUT/PATCH/DELETE), so its absence means a
 * non-browser client — which has no ambient cookies to abuse. The literal
 * "null" origin (sandboxed iframes, some redirects) is refused.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  return allowedOrigins().includes(origin.replace(/\/+$/, ""));
}

/**
 * The origin to put in links we generate (password reset emails, Stripe
 * return URLs, notifications) — the first FRONTEND_URL entry. Using the raw
 * variable produced broken links like "https://a.com,https://b.com/reset…".
 */
export function primaryFrontendUrl(): string {
  return allowedOrigins()[0];
}
