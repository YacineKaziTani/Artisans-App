import type { NextFunction, Request, Response } from "express";
import { isAllowedOrigin } from "../lib/urls";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery guard.
 *
 * In production the auth cookie is SameSite=None (the frontend and API are
 * on different sites), so a browser attaches it to requests started by any
 * website. CORS stops that website from *reading* the response, but not
 * from *sending* the request — a hidden form could still post to the API
 * as the signed-in user. Browsers always say where such a request came
 * from in the Origin header, so anything that changes data must come from
 * one of our own frontends.
 *
 * The Stripe webhook is mounted before this middleware (Stripe's servers
 * send no Origin, and the request is authenticated by its signature).
 */
export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isAllowedOrigin(req.headers.origin)) return next();
  return res.status(403).json({ message: "This request didn't come from the Artisan Market site" });
}
