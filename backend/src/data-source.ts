import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { Shop } from "./modules/shop/shop.entities";
import { Category } from "./modules/category/category.entities";
import { Photo } from "./modules/photos/photo.entities";
import { Product } from "./modules/products/product.entities";
import { ProductImage } from "./modules/products/product-image.entities";
import {
  VariantOption,
  VariantValue,
  ProductVariant,
} from "./modules/products/variant.entities";
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
import { Notification } from "./modules/notifications/notification.entities";
import { NewsletterSubscriber } from "./modules/newsletter/newsletter.entities";
import { AdminAction } from "./modules/audit/admin-action.entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  // Hosted Postgres (Neon, Render) requires TLS but serves a cert node-pg
  // will not verify. A local or CI Postgres usually has no TLS at all, so
  // DB_SSL=false turns it off (it used to be forced on, which made the
  // localhost URL in .env.example fail to connect).
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
  // The schema is managed by migrations (src/migrations), applied on boot.
  // `synchronize` rewrites the live schema to match the entities — it can
  // drop a column on a rename — so it's strictly opt-in via DB_SYNC=true.
  // It used to be on whenever NODE_ENV wasn't "production", which meant a
  // local `npm run dev` pointed at a hosted database altered that schema.
  synchronize: process.env.DB_SYNC === "true",
  migrationsRun: true,
  logging: process.env.NODE_ENV === "development",
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
    Notification,
    NewsletterSubscriber,
    AdminAction,
  ],
  // Anchored to this file's own directory, not the cwd: resolves to
  // src/migrations/*.ts under ts-node and dist/migrations/*.js once compiled.
  migrations: [__dirname + "/migrations/*.{ts,js}"],
});
