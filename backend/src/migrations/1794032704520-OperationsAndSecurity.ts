import { MigrationInterface, QueryRunner } from "typeorm";

export class OperationsAndSecurity1794032704520 implements MigrationInterface {
  name = "OperationsAndSecurity1794032704520";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "admin_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying(60) NOT NULL, "targetType" character varying(30) NOT NULL, "targetId" uuid, "summary" character varying(500) NOT NULL, "details" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "adminId" uuid, CONSTRAINT "PK_08d0b319675c4968ff9e0dca4c3" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_4ad276f1e012771f04f3e9a069" ON "admin_actions" ("targetType", "targetId") `);
    await queryRunner.query(`CREATE INDEX "IDX_b8d6bfd21855eb21c4779903ad" ON "admin_actions" ("createdAt") `);
    await queryRunner.query(`ALTER TABLE "users" ADD "sessionsRevokedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorSecret" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorPendingSecret" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorEnabledAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorRecoveryCodes" jsonb`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD "reminderSentAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "bookingMinNoticeHours" integer NOT NULL DEFAULT '2'`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "bookingMaxDaysAhead" integer NOT NULL DEFAULT '365'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "deliveredAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "messages" ADD "notifiedAt" TIMESTAMP WITH TIME ZONE`);
    // Messages already sitting unread before this release don't trigger a
    // burst of alerts on first boot — only new ones do.
    await queryRunner.query(`UPDATE "messages" SET "notifiedAt" = now() WHERE "readAt" IS NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_unread_unnotified" ON "messages" ("createdAt") WHERE "readAt" IS NULL AND "notifiedAt" IS NULL`);
    await queryRunner.query(`ALTER TABLE "admin_actions" ADD CONSTRAINT "FK_cf57d3f4a67dde3771b17f8c7e8" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admin_actions" DROP CONSTRAINT "FK_cf57d3f4a67dde3771b17f8c7e8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_messages_unread_unnotified"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "notifiedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveredAt"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "bookingMaxDaysAhead"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "bookingMinNoticeHours"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "reminderSentAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorRecoveryCodes"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorEnabledAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorPendingSecret"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorSecret"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sessionsRevokedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b8d6bfd21855eb21c4779903ad"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4ad276f1e012771f04f3e9a069"`);
    await queryRunner.query(`DROP TABLE "admin_actions"`);
  }
}
