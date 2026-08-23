import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";
import { Product } from "../products/product.entities";

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
  PAID = "paid",
  PARTIALLY_REFUNDED = "partially_refunded",
  REFUNDED = "refunded",
  FAILED = "failed",
}

@Entity("orders")
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

  // Free-text carrier tracking reference, set by the artisan when fulfilling
  // a delivery order. No carrier API integration — just a reference field.
  @Column({ nullable: true })
  trackingInfo?: string;

  @ManyToOne(() => User)
  client!: User;

  @ManyToOne(() => Shop)
  shop!: Shop;

  @ManyToOne(() => Product)
  product!: Product;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
