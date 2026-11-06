import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";

@Entity("photos")
@Index(["shop"])
export class Photo {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  url!: string;

  @Column({ nullable: true })
  publicId?: string;

  @Column({ nullable: true })
  caption!: string;

  @ManyToOne(() => Shop, (shop) => shop.photos, { onDelete: "CASCADE" })
  shop!: Shop;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
