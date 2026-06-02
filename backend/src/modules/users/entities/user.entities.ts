import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from "typeorm";
import { Shop } from "../../shop/shop.entities";

export enum UserRole {
  ARTISAN = "artisan",
  CLIENT = "client",
  SUPER_ADMIN = "super_admin",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar", unique: true })
  phone!: string;

  @Column({ type: "varchar" })
  password!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role!: UserRole;

  @Column({ type: "varchar", nullable: true })
  avatarUrl?: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToOne(() => Shop, (shop) => shop.owner)
  shop!: Shop;
}
