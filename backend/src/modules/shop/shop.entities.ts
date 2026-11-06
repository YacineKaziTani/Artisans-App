import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";

import { Category } from "../category/category.entities";
import { Service } from "../services/service.entities";
import { Review } from "../reviews/review.entities";
import { Photo } from "../photos/photo.entities";
import { Booking } from "../booking/booking.entities";
import { Product } from "../products/product.entities";
import { User } from "../users/entities/user.entities";
import { shopCanAcceptPayments } from "../../config/connect";

export enum ShopStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  PENDING = "pending",
  CLOSED = "closed",
}

export enum VerificationStatus {
  NONE = "none",
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

@Entity("shops")
// Public listing: active shops by rating, and category pages.
@Index(["status", "averageRating"])
@Index(["category"])
export class Shop {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  shopName!: string;

  @Column({ type: "varchar", nullable: true })
  description?: string | null;

  @Column({ type: "varchar", nullable: true })
  address?: string | null;

  @Column({ type: "varchar", nullable: true })
  city?: string | null;

  @Column({ type: "varchar", nullable: true })
  logoUrl?: string | null;

  @Column({ type: "varchar", nullable: true })
  phone?: string | null;

  @Column({
    type: "enum",
    enum: ShopStatus,
    default: ShopStatus.PENDING, // needs admin activation
  })
  status!: ShopStatus;

  @Column({ type: "float", default: 0 })
  averageRating!: number;

  @Column({
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.NONE,
  })
  verificationStatus!: VerificationStatus;

  @Column({ type: "text", nullable: true })
  verificationNote?: string | null;

  // Stripe Connect (Express) account — required before this shop can
  // receive bookings/orders, since payouts flow through it.
  @Column({ type: "varchar", nullable: true })
  stripeAccountId?: string | null;

  // Whether the connected account can take card payments and receive
  // transfers. Refreshed whenever the artisan's dashboard checks their
  // Stripe status (GET /shops/mine/stripe-status). There's no Connect
  // webhook endpoint yet, so it isn't updated in the background.
  @Column({ type: "boolean", default: false })
  stripeOnboardingComplete!: boolean;

  @OneToOne(() => User, (user) => user.shop)
  @JoinColumn()
  owner!: User;

  @ManyToOne(() => Category, (cat) => cat.shops)
  category!: Category;

  @OneToMany(() => Service, (s) => s.shop, { cascade: true })
  services!: Service[];

  @OneToMany(() => Review, (r) => r.shop, { cascade: true })
  reviews!: Review[];

  @OneToMany(() => Photo, (p) => p.shop, { cascade: true })
  photos!: Photo[];

  @OneToMany(() => Booking, (b) => b.shop)
  bookings!: Booking[];

  @OneToMany(() => Product, (p) => p.shop, { cascade: true })
  products!: Product[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  /**
   * What a Shop looks like in API responses. The Stripe account id is never
   * sent (no client needs it), and the admin's verification note is only
   * added back for the owner and admins (see ownerShopView). Clients get a
   * ready-made `acceptsPayments` flag instead of re-deriving it from Stripe
   * fields plus a frontend env var.
   */
  toJSON() {
    const { stripeAccountId: _account, verificationNote: _note, ...rest } = this;
    return { ...rest, acceptsPayments: shopCanAcceptPayments(this) };
  }
}

/** A shop as its owner (or an admin) sees it — includes the verification note. */
export function ownerShopView(shop: Shop) {
  return { ...shop.toJSON(), verificationNote: shop.verificationNote ?? null };
}
