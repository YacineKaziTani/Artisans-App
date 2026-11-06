import { MigrationInterface, QueryRunner } from "typeorm";

export class PerformanceIndexes1793950418495 implements MigrationInterface {
  name = "PerformanceIndexes1793950418495";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_e773bd43e120f8a21f795b9150" ON "services" ("shopId") `);
    await queryRunner.query(`CREATE INDEX "IDX_bdef559142a43d73c8b4d618ec" ON "photos" ("shopId") `);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_unpaid_checkouts" ON "bookings" ("createdAt") WHERE "status" = 'pending' AND "paymentStatus" IN ('unpaid', 'failed')`);
    await queryRunner.query(`CREATE INDEX "IDX_1dece759298e187f0921372363" ON "bookings" ("clientId", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_8d5fb5a3a43181e5a9880e5111" ON "bookings" ("shopId", "scheduledAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_b367708bf720c8dd62fc683316" ON "product_images" ("productId") `);
    await queryRunner.query(`CREATE INDEX "IDX_838991b1415fa80037f6bc3d36" ON "variant_options" ("productId") `);
    await queryRunner.query(`CREATE INDEX "IDX_edcba1e6e38f0fccec3cfbd56a" ON "variant_values" ("optionId") `);
    await queryRunner.query(`CREATE INDEX "IDX_f515690c571a03400a9876600b" ON "product_variants" ("productId") `);
    await queryRunner.query(`CREATE INDEX "IDX_41656d731018feaa298a764bb5" ON "products" ("shopId", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_23a2da036629bb4ad2940e7e79" ON "shops" ("categoryId") `);
    await queryRunner.query(`CREATE INDEX "IDX_832aff8228c0d94c5ab1d8fe9c" ON "shops" ("status", "averageRating") `);
    await queryRunner.query(`CREATE INDEX "IDX_orders_unpaid_checkouts" ON "orders" ("createdAt") WHERE "status" = 'pending' AND "paymentStatus" IN ('unpaid', 'failed')`);
    await queryRunner.query(`CREATE INDEX "IDX_5d0d9997b74ffe21230d302629" ON "orders" ("stripePaymentIntentId") `);
    await queryRunner.query(`CREATE INDEX "IDX_8a7274598bccf3d30741085405" ON "orders" ("checkoutGroupId") `);
    await queryRunner.query(`CREATE INDEX "IDX_fd4a94c9e5729530423aed8533" ON "orders" ("clientId", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_d145e086723c05989c22500a71" ON "orders" ("shopId", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_751332fc6cc6fc576c6975cd07" ON "messages" ("conversationId", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_976d3151eca45bcc916c6dc134" ON "conversations" ("shopId", "updatedAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_781a2c0adee4125f1f6906a14a" ON "reports" ("status", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_46366e52d27edeffdf052f992f" ON "reports" ("targetType", "targetId") `);
    await queryRunner.query(`CREATE INDEX "IDX_e3e36a382eb0855b0d4e765416" ON "disputes" ("status", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_6e6bc1ebb94c0b9d5bbd98d871" ON "disputes" ("targetType", "targetId") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_6e6bc1ebb94c0b9d5bbd98d871"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e3e36a382eb0855b0d4e765416"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_46366e52d27edeffdf052f992f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_781a2c0adee4125f1f6906a14a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_976d3151eca45bcc916c6dc134"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_751332fc6cc6fc576c6975cd07"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d145e086723c05989c22500a71"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fd4a94c9e5729530423aed8533"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8a7274598bccf3d30741085405"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5d0d9997b74ffe21230d302629"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_orders_unpaid_checkouts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_832aff8228c0d94c5ab1d8fe9c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_23a2da036629bb4ad2940e7e79"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_41656d731018feaa298a764bb5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f515690c571a03400a9876600b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_edcba1e6e38f0fccec3cfbd56a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_838991b1415fa80037f6bc3d36"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b367708bf720c8dd62fc683316"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8d5fb5a3a43181e5a9880e5111"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1dece759298e187f0921372363"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bookings_unpaid_checkouts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bdef559142a43d73c8b4d618ec"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e773bd43e120f8a21f795b9150"`);
  }
}
