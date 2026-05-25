import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";

@Entity("photos")
export class Photo {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  url!: string;

  @Column({ nullable: true })
  caption!: string;

  @ManyToOne(() => Shop, (shop) => shop.photos, { onDelete: "CASCADE" })
  shop!: Shop;

  @CreateDateColumn()
  createdAt!: Date;
}
