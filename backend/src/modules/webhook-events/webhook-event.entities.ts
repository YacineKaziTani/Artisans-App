import { Entity, PrimaryColumn, CreateDateColumn } from "typeorm";

// Tracks Stripe event IDs we've already processed, so a retried webhook
// delivery (Stripe retries on any non-2xx or timeout) doesn't double-apply
// side effects like marking a booking paid twice.
@Entity("processed_webhook_events")
export class ProcessedWebhookEvent {
  @PrimaryColumn()
  id!: string; // the Stripe event.id

  @CreateDateColumn()
  processedAt!: Date;
}
