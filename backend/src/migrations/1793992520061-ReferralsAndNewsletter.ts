import { MigrationInterface, QueryRunner } from "typeorm";

export class ReferralsAndNewsletter1793992520061 implements MigrationInterface {
  name = "ReferralsAndNewsletter1793992520061";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "newsletter_subscribers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "token" character varying(64) NOT NULL, "confirmedAt" TIMESTAMP WITH TIME ZONE, "unsubscribedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0dc48416511f011f7de7b2a8f83" UNIQUE ("email"), CONSTRAINT "UQ_b5027aab3487ab97e524d9fcf4f" UNIQUE ("token"), CONSTRAINT "PK_38f9333e9961b2fdb589128d19b" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "users" ADD "referralCode" character varying(12)`);
    // Every existing account gets an invite code too (10 random characters).
    await queryRunner.query(`UPDATE "users" SET "referralCode" = upper(substr(md5(random()::text || id::text), 1, 10)) WHERE "referralCode" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_b7f8278f4e89249bb75c9a15899" UNIQUE ("referralCode")`);
    await queryRunner.query(`ALTER TABLE "users" ADD "referredById" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_1142607b5a447cd5ce23ef7798" ON "users" ("referredById") `);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_1142607b5a447cd5ce23ef7798f" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_1142607b5a447cd5ce23ef7798f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1142607b5a447cd5ce23ef7798"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referredById"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_b7f8278f4e89249bb75c9a15899"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referralCode"`);
    await queryRunner.query(`DROP TABLE "newsletter_subscribers"`);
  }
}
