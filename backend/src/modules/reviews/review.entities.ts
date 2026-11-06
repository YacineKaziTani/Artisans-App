import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";

export interface ReviewPhoto {
  url: string;
  publicId: string;
}

export const MAX_REVIEW_PHOTOS = 3;

@Entity("reviews")
// One review per client per shop — enforced by the database, not just a
// check-then-insert in the controller that two requests could race past.
@Unique("UQ_reviews_shop_author", ["shop", "author"])
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "int" })
  rating!: number;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @ManyToOne(() => User)
  author!: User;

  @ManyToOne(() => Shop, (shop) => shop.reviews, { onDelete: "CASCADE" })
  shop!: Shop;

  // The product the review is about, when the client picked one they
  // received from this shop. Shown on that product's page too.
  @Index()
  @ManyToOne(() => Product, { nullable: true, onDelete: "SET NULL" })
  product?: Product | null;

  // Up to MAX_REVIEW_PHOTOS photos the client added (stored on Cloudinary).
  @Column({ type: "jsonb", nullable: true })
  photos?: ReviewPhoto[] | null;

  // The artisan's public reply.
  @Column({ type: "text", nullable: true })
  reply?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  repliedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
