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
