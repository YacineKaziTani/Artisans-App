import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./data-source";
import cookieParser from "cookie-parser";
import cors from "cors";
import shopRoutes from "./modules/shop/shop.routes";
import categoryRoutes from "./modules/category/category.routes";
import serviceRoutes from "./modules/services/service.routes";
import authRoutes from "./modules/users/routes/auth.routes";
import userRoutes from "./modules/users/routes/user.routes";

async function bootstrap() {
  await AppDataSource.initialize();
  console.log("Database connected");

  const app = express();
  app.use(express.json());

  app.use(cookieParser());

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    }),
  );

  app.use("/api/shops", shopRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/services", serviceRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);

  app.listen(3000, () => console.log("Listening on http://localhost:3000"));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
