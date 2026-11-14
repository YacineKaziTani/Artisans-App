import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";

export enum CustomRequestStatus {
  /** Sent by the client, waiting for the artisan's quote. */
  REQUESTED = "requested",
  /** The artisan named a price; the client can accept and pay. */
  QUOTED = "quoted",
  /** The client paid (card on hold) — it's now an order. */
  ACCEPTED = "accepted",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

export interface RequestPhoto {
  url: string;
  publicId: string;
}

export const MAX_REQUEST_PHOTOS = 4;

/**
 * A commission: the client describes what they want, the artisan quotes a
 * price and date, and the client pays the quote through the normal order
 * flow (card hold, fulfil, capture). Once paid it's an ordinary order with
 * `customRequestId` set.
 */
@Entity("custom_requests")
@Index(["shop", "createdAt"])
@Index(["client", "createdAt"])
export class CustomRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: false })
  client!: User;

  @ManyToOne(() => Shop, { nullable: false, onDelete: "CASCADE" })
  shop!: Shop;

  @Column({ type: "text" })
  description!: string;

  // The client's budget and deadline — guidance for the artisan.
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  budget?: number | null;

  @Column({ type: "date", nullable: true })
  neededBy?: string | null;

  @Column({ type: "jsonb", nullable: true })
  photos?: RequestPhoto[] | null;

  @Column({ type: "enum", enum: CustomRequestStatus, default: CustomRequestStatus.REQUESTED })
  status!: CustomRequestStatus;

  // The artisan's quote.
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  quotePrice?: number | null;

  @Column({ type: "date", nullable: true })
  quoteReadyBy?: string | null;

  @Column({ type: "text", nullable: true })
  quoteNote?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  quotedAt?: Date | null;

  // The order that pays for it (set at checkout; the order may still be
  // waiting for payment while status is QUOTED).
  @Column({ type: "uuid", nullable: true })
  orderId?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
