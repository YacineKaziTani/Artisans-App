import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";

export enum ReportTargetType {
  SHOP = "shop",
  PRODUCT = "product",
  SERVICE = "service",
  REVIEW = "review",
}

export enum ReportStatus {
  PENDING = "pending",
  DISMISSED = "dismissed",
  ACTIONED = "actioned",
}

// Flags content for admin review. Deliberately generic (targetType +
// targetId as a plain string) rather than a relation to each entity, so
// reporting doesn't require a new FK/migration every time a new reportable
// entity is added, and a report survives even if the target is later deleted.
@Entity("reports")
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: ReportTargetType })
  targetType!: ReportTargetType;

  @Column()
  targetId!: string;

  // A human-readable snapshot captured at report time (e.g. shop name, or a
  // review excerpt) so admins can see what was reported even if the
  // underlying content changes or is deleted before review.
  @Column({ nullable: true })
  targetLabel?: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "enum", enum: ReportStatus, default: ReportStatus.PENDING })
  status!: ReportStatus;

  @Column({ type: "text", nullable: true })
  adminNote?: string;

  @ManyToOne(() => User)
  reporter!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
