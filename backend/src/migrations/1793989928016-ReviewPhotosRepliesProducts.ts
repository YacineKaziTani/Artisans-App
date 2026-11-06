import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewPhotosRepliesProducts1793989928016 implements MigrationInterface {
  name = "ReviewPhotosRepliesProducts1793989928016";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" ADD "photos" jsonb`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD "reply" text`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD "repliedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD "productId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_a6b3c434392f5d10ec17104366" ON "reviews" ("productId") `);
    await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_a6b3c434392f5d10ec171043666" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_a6b3c434392f5d10ec171043666"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a6b3c434392f5d10ec17104366"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "productId"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "repliedAt"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "reply"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "photos"`);
  }
}
