import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";
import { Message } from "./message.entities";

// One conversation per (client, shop) pair — the client always talks to
// "the shop", and whichever artisan owns that shop sees it in their inbox.
@Entity("conversations")
@Unique(["client", "shop"])
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User)
  client!: User;

  @ManyToOne(() => Shop)
  shop!: Shop;

  @OneToMany(() => Message, (m) => m.conversation)
  messages!: Message[];

  @CreateDateColumn()
  createdAt!: Date;

  // Bumped whenever a new message lands, so conversation lists can sort by
  // most-recently-active without a join+aggregate on every list request.
  @UpdateDateColumn()
  updatedAt!: Date;
}
