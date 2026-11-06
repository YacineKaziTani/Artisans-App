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
 * The origin to put in links we generate (password reset emails, Stripe
 * return URLs, notifications) — the first FRONTEND_URL entry. Using the raw
 * variable produced broken links like "https://a.com,https://b.com/reset…".
 */
export function primaryFrontendUrl(): string {
  return allowedOrigins()[0];
}
