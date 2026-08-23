import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from "typeorm";
import { User } from "../users/entities/user.entities";

export enum FavoriteTargetType {
  SHOP = "shop",
  PRODUCT = "product",
}

// Generic like Report/Dispute — targetType/targetId rather than two
// nullable relations, so favoriting a shop and a product share one table.
@Entity("favorites")
@Unique(["user", "targetType", "targetId"])
export class Favorite {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "enum", enum: FavoriteTargetType })
  targetType!: FavoriteTargetType;

  @Column()
  targetId!: string;

  @ManyToOne(() => User)
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
