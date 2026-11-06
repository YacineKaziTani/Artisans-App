import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from "typeorm";
import { User } from "../users/entities/user.entities";
import { Shop } from "../shop/shop.entities";

@Entity("reviews")
// One review per client per shop — enforced by the database, not just a
// check-then-insert in the controller that two requests could race past.
@Unique("UQ_reviews_shop_author", ["shop", "author"])
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "int" })
  rating!: number;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @ManyToOne(() => User)
  author!: User;

  @ManyToOne(() => Shop, (shop) => shop.reviews, { onDelete: "CASCADE" })
  shop!: Shop;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
