import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Conversation } from "./conversation.entities";

@Entity("messages")
// Loading a thread (newest first, paged) and unread counts.
@Index(["conversation", "createdAt"])
// The unread-message alert job: unread, not yet alerted, oldest first.
@Index("IDX_messages_unread_unnotified", ["createdAt"], { where: `"readAt" IS NULL AND "notifiedAt" IS NULL` })
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  content!: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: "CASCADE" })
  conversation!: Conversation;

  @ManyToOne(() => User)
  sender!: User;

  @Column({ type: "timestamptz", nullable: true })
  readAt?: Date;

  // When the recipient was alerted about it (bell + email) because it sat
  // unread — so each unread message triggers at most one alert.
  @Column({ type: "timestamptz", nullable: true })
  notifiedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
