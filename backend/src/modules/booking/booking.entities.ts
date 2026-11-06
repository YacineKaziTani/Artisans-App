import {
  Entity,
  Index,
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
  AUTHORIZED = "authorized", // card held, not yet charged
  PAID = "paid",
  PARTIALLY_REFUNDED = "partially_refunded",
  REFUNDED = "refunded",
  FAILED = "failed",
}

@Entity("bookings")
// Slot-overlap checks and the artisan/client booking lists.
@Index(["shop", "scheduledAt"])
@Index(["client", "createdAt"])
@Index("IDX_bookings_unpaid_checkouts", ["createdAt"], { where: `"status" = 'pending' AND "paymentStatus" IN ('unpaid', 'failed')` })
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "timestamptz" })
  scheduledAt!: Date;

  // scheduledAt + the service's appointment length, snapshotted at booking
  // time; used for overlap checks. Older rows have none (treated as a
  // one-minute slot).
  @Column({ type: "timestamptz", nullable: true })
  endsAt?: Date | null;

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

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
