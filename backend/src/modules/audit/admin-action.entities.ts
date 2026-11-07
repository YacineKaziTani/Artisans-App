import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../users/entities/user.entities";

/**
 * A record of something an admin did — refunds, suspensions, role changes,
 * approvals — so there's always an answer to "who did this, and when?".
 * Rows are never edited or deleted by the app.
 */
@Entity("admin_actions")
@Index(["createdAt"])
@Index(["targetType", "targetId"])
export class AdminAction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Kept (as null) if the admin account is later removed.
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  admin?: User | null;

  /** e.g. "user.role_changed", "shop.suspended", "dispute.refunded". */
  @Column({ type: "varchar", length: 60 })
  action!: string;

  @Column({ type: "varchar", length: 30 })
  targetType!: string;

  @Column({ type: "uuid", nullable: true })
  targetId?: string | null;

  /** Human-readable summary, e.g. "Refunded $40.00 to Ada". */
  @Column({ type: "varchar", length: 500 })
  summary!: string;

  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
