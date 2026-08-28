const isProd = process.env.NODE_ENV === "production";

// The frontend (Vercel) and the API (Render) live on different sites, so the
// auth cookie has to be SameSite=None — "lax" would stop the browser sending
// it back on any cross-site request. None requires Secure, hence HTTPS only.
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
} as const;

// clearCookie only matches if secure/sameSite match the cookie that was set.
export const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
} as const;
