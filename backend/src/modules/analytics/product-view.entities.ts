import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Product } from "../products/product.entities";

/**
 * Product page views, counted per product per day (UTC). One row per
 * product-day keeps the table small however popular a product gets; no
 * visitor data is stored.
 */
@Entity("product_views")
@Index(["day"])
export class ProductView {
  @PrimaryColumn({ type: "uuid" })
  productId!: string;

  @PrimaryColumn({ type: "date" })
  day!: string;

  @Column({ type: "int", default: 0 })
  views!: number;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product?: Product;
}
