import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { Shop } from "./modules/shop/shop.entities";
import { Category } from "./modules/category/category.entities";
import { Photo } from "./modules/photos/photo.entities";
import { Product } from "./modules/products/product.entities";
import { ProductImage } from "./modules/products/product-image.entities";
import { VariantOption, VariantValue, ProductVariant } from "./modules/products/variant.entities";
import { Review } from "./modules/reviews/review.entities";
import { Service } from "./modules/services/service.entities";
import { Booking } from "./modules/booking/booking.entities";
import { Order } from "./modules/orders/order.entities";
import { ProcessedWebhookEvent } from "./modules/webhook-events/webhook-event.entities";
import { Conversation } from "./modules/messaging/conversation.entities";
import { Message } from "./modules/messaging/message.entities";
import { Report } from "./modules/reports/report.entities";
import { Dispute } from "./modules/disputes/dispute.entities";
import { Favorite } from "./modules/favorites/favorite.entities";
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
    Product,
    ProductImage,
    VariantOption,
    VariantValue,
    ProductVariant,
    Review,
    Service,
    Booking,
    Order,
    ProcessedWebhookEvent,
    Conversation,
    Message,
    Report,
    Dispute,
    Favorite,
  ],
  migrations: ["src/migrations/*.ts"],
});
