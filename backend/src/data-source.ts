import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { User } from "./modules/users/entities/user.entities";
import { Shop } from "./modules/shop/shop.entities";
import { Category } from "./modules/category/category.entities";
import { Service } from "./modules/services/service.entities";
import { Review } from "./modules/reviews/review.entities";
import { Photo } from "./modules/photos/photo.entities";
import { Booking } from "./modules/booking/booking.entities";
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: true ,//false, 

  logging: process.env.NODE_ENV === "development", // 'production'
  entities: [User,Shop,Category,Service,Review,Photo,Booking],
  migrations: ["src/migrations/*.ts"],
});
