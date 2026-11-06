import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// These counters live in this process's memory. That's right for a single
// instance, but with two or more instances each keeps its own count (so
// the real limit is N × the number below) and a restart resets them. When
// scaling out, give each limiter a shared store — e.g. `rate-limit-redis`
// — and Socket.io the `@socket.io/redis-adapter`, so a message emitted on
// one instance reaches users connected to another. The checkout expiry job
// is already safe to run on every instance.

// Generous default for normal browsing/API traffic.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit on auth endpoints to slow down credential stuffing / brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

// Payment-creating endpoints (bookings, orders) — limited separately since
// each call creates a real Stripe PaymentIntent.
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

// Reports and disputes land in a human moderation queue, so cap how fast
// one account can fill it. Keyed by user when signed in (these routes all
// are), so people sharing an IP don't throttle each other.
export const moderationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  message: {
    message: "You've sent a lot of reports recently — please try again later",
  },
});
