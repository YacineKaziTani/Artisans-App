import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";

import { Category } from "../category/category.entities";
import { Service } from "../services/service.entities";
import { Review } from "../reviews/review.entities";
import { Photo } from "../photos/photo.entities";
import { Booking } from "../booking/booking.entities";
import { Product } from "../products/product.entities";
import { User } from "../users/entities/user.entities";

export enum ShopStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  PENDING = "pending",
  CLOSED = "closed",
}

@Entity("shops")
export class Shop {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  shopName!: string;

  @Column({ type: "varchar", nullable: true })
  description?: string;

  @Column({ type: "varchar", nullable: true })
  address?: string;

  @Column({ type: "varchar", nullable: true })
  city?: string;

  @Column({ type: "varchar", nullable: true })
  logoUrl?: string;

  @Column({ type: "varchar", nullable: true })
  phone?: string;

  @Column({
    type: "enum",
    enum: ShopStatus,
    default: ShopStatus.PENDING, // needs admin activation
  })
  status!: ShopStatus;

  @Column({ type: "float", default: 0 })
  averageRating!: number;

  @OneToOne(() => User, (user) => user.shop)
  @JoinColumn()
  owner!: User;

  @ManyToOne(() => Category, (cat) => cat.shops)
  category!: Category;

  @OneToMany(() => Service, (s) => s.shop, { cascade: true })
  services!: Service[];

  @OneToMany(() => Review, (r) => r.shop, { cascade: true })
  reviews!: Review[];

  @OneToMany(() => Photo, (p) => p.shop, { cascade: true })
  photos!: Photo[];

  @OneToMany(() => Booking, (b) => b.shop)
  bookings!: Booking[];

  @OneToMany(() => Product, (p) => p.shop, { cascade: true })
  products!: Product[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
