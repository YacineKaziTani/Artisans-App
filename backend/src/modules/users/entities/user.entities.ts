import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
  ManyToOne,
} from "typeorm";
import { Shop } from "../../shop/shop.entities";
import { publicProfile } from "../user.views";

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

  @Column({ type: "varchar", select: false })
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
  avatarUrl?: string | null;

  @Column({ type: "varchar", nullable: true, select: false })
  resetPasswordTokenHash?: string | null;

  @Column({ type: "timestamptz", nullable: true, select: false })
  resetPasswordExpiresAt?: Date | null;

  // When the user proved they own `email` (clicked the link we sent, or
  // completed a password reset). Until then they can browse and sign in,
  // but not buy, book, message or post.
  @Column({ type: "timestamptz", nullable: true })
  emailVerifiedAt?: Date | null;

  // sha256 of the single-use link token; the raw token only ever exists in
  // the email.
  @Index()
  @Column({ type: "varchar", nullable: true, select: false })
  emailVerificationTokenHash?: string | null;

  @Column({ type: "timestamptz", nullable: true, select: false })
  emailVerificationExpiresAt?: Date | null;

  // Activity emails (orders, bookings, disputes, review replies). They're
  // also in the in-app bell either way. Security emails (confirmation,
  // password reset) always go out.
  @Column({ type: "boolean", default: true })
  emailNotifications!: boolean;

  // Their invite code (/register?ref=CODE) and who invited them, if anyone.
  @Column({ type: "varchar", length: 12, unique: true, nullable: true })
  referralCode?: string | null;

  @Index()
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  referredBy?: User | null;

  @Column({ type: "timestamptz", nullable: true })
  acceptedTermsAt?: Date;

  @Column({ type: "timestamptz", nullable: true })
  passwordChangedAt?: Date;

  @Column({ type: "int", default: 0, select: false })
  failedLoginAttempts!: number;

  @Column({ type: "timestamptz", nullable: true, select: false })
  lockedUntil?: Date | null;

  // Set when an admin deletes the account. The row stays (orders, bookings
  // and messages still reference it) but its personal data is scrubbed and
  // it can no longer sign in.
  @Column({ type: "timestamptz", nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToOne(() => Shop, (shop) => shop.owner)
  shop!: Shop;

  /**
   * Private by default: a User in any API response is reduced to its public
   * profile (name, avatar). Endpoints that legitimately return the full
   * account — the user's own profile, admin user management — build it
   * explicitly with accountView(). Before this, conversations, messages and
   * order lists sent the other party's email and phone number.
   */
  toJSON() {
    return publicProfile(this);
  }
}
