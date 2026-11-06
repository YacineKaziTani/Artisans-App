import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductStock1793969196098 implements MigrationInterface {
  name = "ProductStock1793969196098";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "stockQuantity" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "stockQuantity"`);
  }
}
