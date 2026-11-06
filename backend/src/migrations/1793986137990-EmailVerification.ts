import { MigrationInterface, QueryRunner } from "typeorm";

export class EmailVerification1793986137990 implements MigrationInterface {
  name = "EmailVerification1793986137990";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationTokenHash" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationExpiresAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX "IDX_b3b08b9bfa724a55e787c5b8fe" ON "users" ("emailVerificationTokenHash") `);

    // Accounts that exist before email confirmation was introduced keep
    // working as they did: they're treated as confirmed. Only new sign-ups
    // have to click the link.
    await queryRunner.query(`UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_b3b08b9bfa724a55e787c5b8fe"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationTokenHash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
  }
}
