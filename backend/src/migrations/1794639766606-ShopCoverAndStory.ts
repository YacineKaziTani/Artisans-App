import { MigrationInterface, QueryRunner } from "typeorm";

export class ShopCoverAndStory1794639766606 implements MigrationInterface {
  name = "ShopCoverAndStory1794639766606";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shops" ADD "coverUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "coverPublicId" character varying`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "story" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "story"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "coverPublicId"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "coverUrl"`);
  }
}
