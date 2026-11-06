import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Product } from "./product.entities";

@Entity("product_images")
@Index(["product"])
export class ProductImage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  url!: string;

  @Column({ nullable: true })
  publicId?: string; // Cloudinary public_id, for cleanup on delete

  @ManyToOne(() => Product, (product) => product.images, { onDelete: "CASCADE" })
  product!: Product;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
