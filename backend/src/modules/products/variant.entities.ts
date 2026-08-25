import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Product } from "./product.entities";

// An axis of variation on a product — e.g. "Size" or "Color". Belongs to
// one product; a t-shirt might have two of these (Size, Color), a watch
// might have two different ones (Color, Material).
@Entity("variant_options")
export class VariantOption {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @ManyToOne(() => Product, (product) => product.variantOptions, {
    onDelete: "CASCADE",
  })
  product!: Product;

  @OneToMany(() => VariantValue, (value) => value.option, { cascade: true })
  values!: VariantValue[];

  @CreateDateColumn()
  createdAt!: Date;
}

// A single choice within an option — e.g. "M" under Size, or "Red" under
// Color. priceModifier is an optional additive adjustment to the product's
// base price when this value is part of a chosen variant (e.g. a larger
// size costing $2 more) — most values will leave it at 0.
@Entity("variant_values")
export class VariantValue {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  value!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  priceModifier!: number;

  @ManyToOne(() => VariantOption, (option) => option.values, {
    onDelete: "CASCADE",
  })
  option!: VariantOption;
}

// A specific purchasable combination — e.g. Size=M + Color=Red — with its
// own stock count and (optionally) its own fixed price. This is the actual
// SKU a client selects and buys; Product.basePrice/imageUrl stay as the
// "default"/display values for the listing overall.
@Entity("product_variants")
export class ProductVariant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ nullable: true })
  sku?: string;

  @Column({ type: "int", default: 0 })
  stockQuantity!: number;

  // If set, this exact price is used instead of basePrice + value modifiers.
  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  priceOverride?: number;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: "CASCADE",
  })
  product!: Product;

  @ManyToMany(() => VariantValue)
  @JoinTable({ name: "product_variant_values" })
  values!: VariantValue[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
