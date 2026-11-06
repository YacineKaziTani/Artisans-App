import { MigrationInterface, QueryRunner } from "typeorm";

export class OpeningHoursAndDelivery1793988236611 implements MigrationInterface {
  name = "OpeningHoursAndDelivery1793988236611";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shops" ADD "timezone" character varying NOT NULL DEFAULT 'UTC'`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "openingHours" jsonb`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "pickupEnabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "deliveryEnabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "deliveryFee" numeric(10,2) NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "freeDeliveryOver" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "deliveryArea" character varying(300)`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryFee" numeric(10,2) NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryFee"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "deliveryArea"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "freeDeliveryOver"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "deliveryFee"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "deliveryEnabled"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "pickupEnabled"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "openingHours"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "timezone"`);
  }
}
