import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Shop } from "../shop/shop.entities";

export enum DiscountKind {
  /** `value` percent off the items (not delivery). */
  PERCENT = "percent",
  /** `value` dollars off the items. */
  AMOUNT = "amount",
  /** Delivery is free. */
  FREE_DELIVERY = "free_delivery",
}

/**
 * A shop's promo code, applied at checkout to that shop's items. How many
 * times it's been used is counted from the orders that carry it (see
 * discounts.ts), so an abandoned checkout gives its use back automatically.
 */
@Entity("discount_codes")
@Unique("UQ_discount_codes_shop_code", ["shop", "code"])
export class DiscountCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Shop, { nullable: false, onDelete: "CASCADE" })
  shop!: Shop;

  // Stored upper-case; matched case-insensitively.
  @Column({ type: "varchar", length: 40 })
  code!: string;

  @Column({ type: "enum", enum: DiscountKind })
  kind!: DiscountKind;

  // Percent (1–90) or dollars; unused for free delivery.
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  value!: number;

  // Items must come to at least this much.
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  minSubtotal?: number | null;

  @Column({ type: "timestamptz", nullable: true })
  startsAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt?: Date | null;

  // Total checkouts allowed (null = unlimited).
  @Column({ type: "int", nullable: true })
  maxUses?: number | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
