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

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
