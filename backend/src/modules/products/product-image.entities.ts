import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Product } from "./product.entities";

@Entity("product_images")
export class ProductImage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  url!: string;

  @Column({ nullable: true })
  publicId?: string; // Cloudinary public_id, for cleanup on delete

  @ManyToOne(() => Product, (product) => product.images, { onDelete: "CASCADE" })
  product!: Product;

  @CreateDateColumn()
  createdAt!: Date;
}
