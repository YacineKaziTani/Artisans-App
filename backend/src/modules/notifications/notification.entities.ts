import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";

/**
 * An in-app notification (the bell). Created alongside each activity
 * email — order and booking updates, disputes, review replies — so people
 * see them on the site even with activity emails turned off.
 */
@Entity("notifications")
@Index(["user", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "text", nullable: true })
  body?: string | null;

  /** Where clicking it goes, e.g. "/profile-client". */
  @Column({ type: "varchar", length: 300, nullable: true })
  link?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  readAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
