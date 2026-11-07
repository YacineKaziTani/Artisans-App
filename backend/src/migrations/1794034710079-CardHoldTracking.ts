import { MigrationInterface, QueryRunner } from "typeorm";

export class CardHoldTracking1794034710079 implements MigrationInterface {
  name = "CardHoldTracking1794034710079";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" ADD "authorizedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD "holdReminderSentAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "authorizedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "holdReminderSentAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "holdReminderSentAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "authorizedAt"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "holdReminderSentAt"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "authorizedAt"`);
  }
}
