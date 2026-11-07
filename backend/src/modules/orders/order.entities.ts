import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";
import { ProductVariant } from "../products/variant.entities";

export enum OrderStatus {
  PENDING = "pending",
  FULFILLED = "fulfilled",
  CANCELLED = "cancelled",
}

export enum DeliveryMethod {
  PICKUP = "pickup",
  DELIVERY = "delivery",
}

export enum OrderPaymentStatus {
  UNPAID = "unpaid",
  AUTHORIZED = "authorized", // card held, not yet charged
  PAID = "paid",
  PARTIALLY_REFUNDED = "partially_refunded",
  REFUNDED = "refunded",
  FAILED = "failed",
}

@Entity("orders")
// Artisan and client order lists, cart settlement, webhook lookups.
@Index(["shop", "createdAt"])
@Index(["client", "createdAt"])
@Index(["checkoutGroupId"])
@Index(["stripePaymentIntentId"])
// The unpaid-checkout expiry sweep only ever looks at this sliver of rows.
@Index("IDX_orders_unpaid_checkouts", ["createdAt"], { where: `"status" = 'pending' AND "paymentStatus" IN ('unpaid', 'failed')` })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "int", default: 1 })
  quantity!: number;

  // Snapshot of product.basePrice * quantity at order time
  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({
    type: "enum",
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.UNPAID,
  })
  paymentStatus!: OrderPaymentStatus;

  @Column({ nullable: true })
  stripePaymentIntentId?: string;

  // Groups order rows created together from a single multi-item cart
  // checkout, so they share one PaymentIntent/refund even though each
  // order still belongs to a single shop+product for artisan fulfillment.
  @Column({ nullable: true })
  checkoutGroupId?: string;

  @Column({
    type: "enum",
    enum: DeliveryMethod,
    default: DeliveryMethod.PICKUP,
  })
  deliveryMethod!: DeliveryMethod;

  @Column({ type: "text", nullable: true })
  shippingAddress?: string;

  // The delivery charge included in totalAmount (0 for pickup). In a cart
  // it's charged once, on the first line, so the existing per-line capture
  // and refund maths cover it unchanged.
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  deliveryFee!: number;

  // Free-text carrier tracking reference, set by the artisan when fulfilling
  // a delivery order. No carrier API integration — just a reference field.
  @Column({ nullable: true })
  trackingInfo?: string;

  // For delivery orders: when the client confirmed it arrived. (Fulfilled
  // means shipped/handed over — that's when the card is charged.)
  @Column({ type: "timestamptz", nullable: true })
  deliveredAt?: Date | null;

  // When the card hold was placed (authorization webhook), and when the
  // artisan was reminded that it's about to lapse. Card holds last about 7
  // days; after that Stripe drops them and the sale is lost.
  @Column({ type: "timestamptz", nullable: true })
  authorizedAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  holdReminderSentAt?: Date | null;

  @ManyToOne(() => User)
  client!: User;

  @ManyToOne(() => Shop)
  shop!: Shop;

  // The same column as the `product` relation, exposed directly so stock can
  // be restored without loading the product.
  @Column({ type: "uuid", nullable: true })
  productId?: string | null;

  @ManyToOne(() => Product)
  @JoinColumn({ name: "productId" })
  product!: Product;

  // Which specific variant (e.g. Size=M, Color=Red) was ordered, if the
  // product has variants. Nullable since not every product has any.
  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: "SET NULL" })
  variant?: ProductVariant;

  // Snapshot of the variant's values at order time (e.g. "Size: M, Color:
  // Red") so order history stays readable even if the variant is later
  // edited or deleted.
  @Column({ nullable: true })
  variantLabel?: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
