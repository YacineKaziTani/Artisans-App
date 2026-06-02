import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { Shop } from "./modules/shop/shop.entities";
import { Category } from "./modules/category/category.entities";
import { Photo } from "./modules/photos/photo.entities";
import { Option } from "./modules/option/option.entities";
import { Product } from "./modules/products/product.entities";
import { Review } from "./modules/reviews/review.entities";
import { Service } from "./modules/services/service.entities";
import { Booking } from "./modules/booking/booking.entities";
import { User } from "./modules/users/entities/user.entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: true, //false,

  logging: process.env.NODE_ENV === "development", // 'production'
  entities: [
    User,
    Shop,
    Category,
    Photo,
    Option,
    Product,
    Review,
    Service,
    Booking,
  ],
  migrations: ["src/migrations/*.ts"],
});
