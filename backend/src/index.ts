import "reflect-metadata";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import { AppDataSource } from "./data-source";
import cookieParser from "cookie-parser";
import cors from "cors";
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
import { stripeWebhook } from "./modules/booking/booking.controller";
import { generalLimiter } from "./middleware/rate-limit.middleware";
import { initSocketServer } from "./realtime/socket";

async function bootstrap() {
  await AppDataSource.initialize();
  console.log("Database connected");

  const app = express();

  if (process.env.TRUST_PROXY) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.post(
    "/api/bookings/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );

  app.use(express.json());

  app.use(cookieParser());

  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim());

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );

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

  const httpServer = createServer(app);
  initSocketServer(httpServer);

  const port = Number(process.env.PORT ?? 3000);
  httpServer.listen(port, () =>
    console.log(`Listening on http://localhost:${port}`),
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
