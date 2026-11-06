import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// The integration tests send every request from one address, faster than
// any person would; NODE_ENV=test is only ever set by that harness.
const inTestRun = () => process.env.NODE_ENV === "test";

// These counters live in this process's memory. That's right for a single
// instance, but with two or more instances each keeps its own count (so
// the real limit is N × the number below) and a restart resets them. When
// scaling out, give each limiter a shared store — e.g. `rate-limit-redis`
// — and Socket.io the `@socket.io/redis-adapter`, so a message emitted on
// one instance reaches users connected to another. The checkout expiry job
// is already safe to run on every instance.

// Generous default for normal browsing/API traffic.
export const generalLimiter = rateLimit({
  skip: inTestRun,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit on auth endpoints to slow down credential stuffing / brute force.
export const authLimiter = rateLimit({
  skip: inTestRun,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

// Payment-creating endpoints (bookings, orders) — limited separately since
// each call creates a real Stripe PaymentIntent.
export const paymentLimiter = rateLimit({
  skip: inTestRun,
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
  skip: inTestRun,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ""),
  message: {
    message: "You've sent a lot of reports recently — please try again later",
  },
});

// The contact form emails a person — keep it to a handful per hour per IP.
export const contactLimiter = rateLimit({
  skip: inTestRun,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You've sent several messages already — please try again in an hour, or email us directly." },
});
