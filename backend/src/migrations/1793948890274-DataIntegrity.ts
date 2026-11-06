import { MigrationInterface, QueryRunner } from "typeorm";

// Columns that were `timestamp without time zone`. Their values are UTC wall
// time — createdAt/updatedAt are filled by now() in a UTC session, and
// scheduledAt was written by the API running in UTC — so they're converted
// in place, reading each value as UTC. (TypeORM's generated diff would have
// dropped and re-added each column, deleting every timestamp.)
const TIMESTAMP_COLUMNS: [table: string, column: string][] = [
  ["services", "createdAt"],
  ["reviews", "createdAt"],
  ["photos", "createdAt"],
  ["bookings", "scheduledAt"],
  ["bookings", "createdAt"],
  ["bookings", "updatedAt"],
  ["product_images", "createdAt"],
  ["variant_options", "createdAt"],
  ["product_variants", "createdAt"],
  ["product_variants", "updatedAt"],
  ["orders", "createdAt"],
  ["orders", "updatedAt"],
  ["processed_webhook_events", "processedAt"],
  ["messages", "createdAt"],
  ["conversations", "createdAt"],
  ["conversations", "updatedAt"],
  ["reports", "createdAt"],
  ["reports", "updatedAt"],
  ["disputes", "createdAt"],
  ["disputes", "updatedAt"],
  ["favorites", "createdAt"],
];

export class DataIntegrity1793948890274 implements MigrationInterface {
  name = "DataIntegrity1793948890274";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Archive instead of delete, account deletion, booking lengths.
    await queryRunner.query(`ALTER TABLE "services" ADD "durationMinutes" integer`);
    await queryRunner.query(`ALTER TABLE "services" ADD "archivedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD "endsAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "products" ADD "archivedAt" TIMESTAMP WITH TIME ZONE`);

    for (const [table, column] of TIMESTAMP_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }

    // One review per client per shop. The API already refused a second
    // review, but two concurrent requests could slip past that check — keep
    // each author's earliest review before adding the constraint.
    await queryRunner.query(`
      DELETE FROM "reviews" newer
      USING "reviews" older
      WHERE newer."shopId" = older."shopId"
        AND newer."authorId" = older."authorId"
        AND (newer."createdAt", newer."id") > (older."createdAt", older."id")
    `);
    await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "UQ_reviews_shop_author" UNIQUE ("shopId", "authorId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "UQ_reviews_shop_author"`);

    for (const [table, column] of [...TIMESTAMP_COLUMNS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITHOUT TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "archivedAt"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "endsAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "archivedAt"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "durationMinutes"`);
  }
}
