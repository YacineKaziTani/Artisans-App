import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Product } from "../products/product.entities";

@Entity("options")
export class Option {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  label!: string;

  @ManyToOne(() => Product, (product) => product.options, {
    onDelete: "CASCADE",
  })
  product!: Product;

  @OneToMany(() => Value, (value) => value.option, { cascade: true })
  values!: Value[];
}

@Entity("values")
export class Value {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  priceModifier!: number;

  @ManyToOne(() => Option, (option) => option.values, { onDelete: "CASCADE" })
  option!: Option;
}
