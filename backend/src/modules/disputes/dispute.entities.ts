import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";

export enum DisputeTargetType {
  BOOKING = "booking",
  ORDER = "order",
}

export enum DisputeStatus {
  OPEN = "open",
  RESOLVED_REFUNDED = "resolved_refunded",
  RESOLVED_DENIED = "resolved_denied",
  RESOLVED_OTHER = "resolved_other",
}

// Generic like Report — targetType/targetId rather than two nullable FKs,
// so one dispute model covers both bookings and orders without a union of
// optional relations.
@Entity("disputes")
export class Dispute {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: DisputeTargetType })
  targetType!: DisputeTargetType;

  @Column()
  targetId!: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "enum", enum: DisputeStatus, default: DisputeStatus.OPEN })
  status!: DisputeStatus;

  @Column({ type: "text", nullable: true })
  resolutionNote?: string;

  @ManyToOne(() => User)
  raisedBy!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
