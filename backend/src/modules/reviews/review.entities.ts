import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";

@Entity("reviews")
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "int" })
  rating!: number;

  @Column({ type: "text", nullable: true })
  comment!: string;

  @ManyToOne(() => User)
  author!: User;

  @ManyToOne(() => Shop, (shop) => shop.reviews, { onDelete: "CASCADE" })
  shop!: Shop;

  @CreateDateColumn()
  createdAt!: Date;
}
