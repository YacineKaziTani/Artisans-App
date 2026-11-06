import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";
import { ProductImage } from "./product-image.entities";
import { VariantOption, ProductVariant } from "./variant.entities";

@Entity("products")
@Index(["shop", "createdAt"])
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  basePrice!: number;

  // Stock for a product sold without variants. NULL means "not tracked"
  // (made to order — any quantity can be ordered); a number is reserved at
  // checkout exactly like variant stock. Products with variants keep their
  // stock per variant and leave this empty.
  @Column({ type: "int", nullable: true })
  stockQuantity?: number | null;

  // Cover image, kept for backward compatibility with existing product
  // cards/listings — always mirrors the first row in `images` below.
  @Column({ type: "varchar", nullable: true })
  imageUrl?: string | null;

  // Set instead of deleting a product that already has orders, so order
  // history keeps pointing at a real row. Archived products are hidden from
  // every listing and can't be bought.
  @Column({ type: "timestamptz", nullable: true })
  archivedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => Shop, (shop) => shop.products, { onDelete: "CASCADE" })
  shop!: Shop;

  @OneToMany(() => VariantOption, (option) => option.product, { cascade: true })
  variantOptions!: VariantOption[];

  @OneToMany(() => ProductVariant, (variant) => variant.product, { cascade: true })
  variants!: ProductVariant[];

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  images!: ProductImage[];
}
