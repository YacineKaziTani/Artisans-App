import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  name!: string;

  @Column({ type: "varchar", nullable: true })
  description?: string;

  @Column({ type: "varchar", nullable: true })
  iconUrl?: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @OneToMany(() => Shop, (shop) => shop.category)
  shops!: Shop[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
