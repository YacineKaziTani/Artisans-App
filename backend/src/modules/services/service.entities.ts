import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";

@Entity("services")
export class Service {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ nullable: true })
  duration!: string;

  @Column({ default: true })
  isAvailable!: boolean;

  @ManyToOne(() => Shop, (shop) => shop.services, { onDelete: "CASCADE" })
  shop!: Shop;

  @CreateDateColumn()
  createdAt!: Date;
}
