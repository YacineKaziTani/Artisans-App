import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * A newsletter sign-up. Double opt-in: it only counts once the address has
 * clicked the confirmation link (confirmedAt). The token is in every email
 * so one click unsubscribes.
 */
@Entity("newsletter_subscribers")
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  token!: string;

  @Column({ type: "timestamptz", nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  unsubscribedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
