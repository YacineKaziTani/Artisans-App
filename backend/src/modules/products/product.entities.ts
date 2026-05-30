import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";
import { Option } from "../option/option.entities";

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  basePrice!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  // @ManyToOne(() => Shop, (shop) => shop.products, { onDelete: "CASCADE" })
  // shop!: Shop;

  @OneToMany(() => Option, (option) => option.product, { cascade: true })
  options!: Option[];
}
