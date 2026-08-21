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
import { Service } from "../services/service.entities";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

export enum PaymentStatus {
  UNPAID = "unpaid",
  PAID = "paid",
  REFUNDED = "refunded",
  FAILED = "failed",
}

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "timestamp" })
  scheduledAt!: Date;

  @Column({ type: "text", nullable: true })
  notes!: string;

  @Column({ type: "enum", enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  // Snapshot of the service price at booking time, in the service's currency unit (e.g. dollars).
  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus!: PaymentStatus;

  @Column({ nullable: true })
  stripePaymentIntentId?: string;

  @ManyToOne(() => User)
  client!: User;

  @ManyToOne(() => Shop, (shop) => shop.bookings)
  shop!: Shop;

  @ManyToOne(() => Service)
  service!: Service;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
