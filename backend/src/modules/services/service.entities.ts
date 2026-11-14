import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { Shop } from "../shop/shop.entities";

@Entity("services")
@Index(["shop"])
export class Service {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  // Free-text, shown to clients (e.g. "2-4 weeks").
  @Column({ nullable: true })
  duration?: string;

  // How long one appointment occupies the artisan, used to stop overlapping
  // bookings. Left empty, bookings only clash at the exact same start time.
  @Column({ type: "int", nullable: true })
  durationMinutes?: number | null;

  @Column({ default: true })
  isAvailable!: boolean;

  // Places per session: 1 = a private appointment; more = a class or
  // workshop several clients book into at the same start time.
  @Column({ type: "int", default: 1 })
  capacity!: number;

  // Set instead of deleting a service that already has bookings. Archived
  // services are hidden from the shop and can't be booked.
  @Column({ type: "timestamptz", nullable: true })
  archivedAt?: Date | null;

  @ManyToOne(() => Shop, (shop) => shop.services, { onDelete: "CASCADE" })
  shop!: Shop;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
