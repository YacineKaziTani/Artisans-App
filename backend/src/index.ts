import "reflect-metadata";
import express from "express";
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
import { stripeWebhook } from "./modules/booking/booking.controller";
import { generalLimiter } from "./middleware/rate-limit.middleware";
import { initSocketServer } from "./realtime/socket";

async function bootstrap() {
  await AppDataSource.initialize();
  console.log("Database connected");

  const app = express();

  // Stripe webhook needs the raw request body to verify the signature, so
  // it's mounted before express.json() parses everything else.
  app.post(
    "/api/bookings/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );

  app.use(express.json());

  app.use(cookieParser());

  app.use(
    cors({
      origin: "http://localhost:5173",
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

  const httpServer = createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(3000, () => console.log("Listening on http://localhost:3000"));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
