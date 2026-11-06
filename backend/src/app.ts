import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import { AppDataSource } from "./data-source";
import shopRoutes from "./modules/shop/shop.routes";
import categoryRoutes from "./modules/category/category.routes";
import serviceRoutes from "./modules/services/service.routes";
import authRoutes from "./modules/users/routes/auth.routes";
import userRoutes from "./modules/users/routes/user.routes";
import reviewsRoutes from "./modules/reviews/review.routes";
import bookingRoutes from "./modules/booking/booking.routes";
import photoRoutes from "./modules/photos/photo.routes";
import productRoutes from "./modules/products/product.routes";
import orderRoutes from "./modules/orders/order.routes";
import conversationRoutes from "./modules/messaging/conversation.routes";
import reportRoutes from "./modules/reports/report.routes";
import disputeRoutes from "./modules/disputes/dispute.routes";
import favoriteRoutes from "./modules/favorites/favorite.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import supportRoutes from "./modules/support/support.routes";
import seoRoutes from "./modules/seo/seo.routes";
import newsletterRoutes from "./modules/newsletter/newsletter.routes";
import metricsRoutes from "./modules/metrics/metrics.routes";
import { stripeWebhook } from "./modules/booking/booking.controller";
import { generalLimiter } from "./middleware/rate-limit.middleware";
import { requireTrustedOrigin } from "./middleware/origin.middleware";
import { allowedOrigins } from "./lib/urls";

const HEALTH_DB_TIMEOUT_MS = 2000;

/** Resolves true if the database answers a trivial query in time. */
async function databaseIsUp() {
  if (!AppDataSource.isInitialized) return false;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      AppDataSource.query("SELECT 1").then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), HEALTH_DB_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The Express app, without a listening server, database connection or
 * background jobs — `index.ts` adds those. Tests build it directly.
 */
export function createApp() {
  const app = express();

  if (process.env.TRUST_PROXY) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Stripe signs the raw body, so this must come before express.json().
  app.post(
    "/api/bookings/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: allowedOrigins(),
      credentials: true,
    }),
  );

  // Health check for the host (Render). It used to answer "ok" even with
  // the database unreachable, so a broken instance kept receiving traffic.
  app.get("/healthz", async (_req, res) => {
    const db = await databaseIsUp();
    res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db });
  });

  app.use("/api", requireTrustedOrigin);
  app.use("/api", generalLimiter);

  app.use("/api/shops", shopRoutes);
  app.use("/api/reviews", reviewsRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/services", serviceRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/photos", photoRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/disputes", disputeRoutes);
  app.use("/api/favorites", favoriteRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/seo", seoRoutes);
  app.use("/api/newsletter", newsletterRoutes);
  app.use("/api/metrics", metricsRoutes);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("Unhandled error:", err);
      if (res.headersSent) return;
      res.status(500).json({ message: "Internal server error" });
    },
  );

  return app;
}
