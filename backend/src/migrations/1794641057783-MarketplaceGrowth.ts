import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketplaceGrowth1794641057783 implements MigrationInterface {
  name = "MarketplaceGrowth1794641057783";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."custom_requests_status_enum" AS ENUM('requested', 'quoted', 'accepted', 'declined', 'cancelled')`);
    await queryRunner.query(`CREATE TABLE "custom_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" text NOT NULL, "budget" numeric(10,2), "neededBy" date, "photos" jsonb, "status" "public"."custom_requests_status_enum" NOT NULL DEFAULT 'requested', "quotePrice" numeric(10,2), "quoteReadyBy" date, "quoteNote" text, "quotedAt" TIMESTAMP WITH TIME ZONE, "orderId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clientId" uuid NOT NULL, "shopId" uuid NOT NULL, CONSTRAINT "PK_14afd119cdae20728737574a3ea" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_3b8843d78349a721b3b404d6a3" ON "custom_requests" ("clientId", "createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_fccb4e40554aaea605a0bbddf7" ON "custom_requests" ("shopId", "createdAt") `);
    await queryRunner.query(`CREATE TYPE "public"."discount_codes_kind_enum" AS ENUM('percent', 'amount', 'free_delivery')`);
    await queryRunner.query(`CREATE TABLE "discount_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(40) NOT NULL, "kind" "public"."discount_codes_kind_enum" NOT NULL, "value" numeric(10,2) NOT NULL DEFAULT '0', "minSubtotal" numeric(10,2), "startsAt" TIMESTAMP WITH TIME ZONE, "expiresAt" TIMESTAMP WITH TIME ZONE, "maxUses" integer, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "shopId" uuid NOT NULL, CONSTRAINT "UQ_discount_codes_shop_code" UNIQUE ("shopId", "code"), CONSTRAINT "PK_c0170a28d937472e9ce50fdce17" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "product_views" ("productId" uuid NOT NULL, "day" date NOT NULL, "views" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_a515961139d5953a2ee675c127d" PRIMARY KEY ("productId", "day"))`);
    await queryRunner.query(`CREATE INDEX "IDX_5cb49a29b30e549bd6ab7cdd1f" ON "product_views" ("day") `);
    await queryRunner.query(`ALTER TABLE "services" ADD "capacity" integer NOT NULL DEFAULT '1'`);
    await queryRunner.query(`ALTER TABLE "users" ADD "quickReplies" jsonb`);
    await queryRunner.query(`ALTER TABLE "products" ADD "compareAtPrice" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "products" ADD "featured" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD "seats" integer NOT NULL DEFAULT '1'`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "holidayUntil" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "holidayMessage" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "holidayStartedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "calendarToken" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "lowStockThreshold" integer NOT NULL DEFAULT '2'`);
    await queryRunner.query(`ALTER TABLE "shops" ADD "followersNotifiedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "title" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "customRequestId" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "discountCodeId" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "discountCode" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "discountAmount" numeric(10,2) NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "messages" ADD "attachments" jsonb`);
    await queryRunner.query(`ALTER TABLE "messages" ADD "isAutomatic" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "conversations" ADD "autoRepliedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_36a0540c646116e1d8c5df22ea" ON "shops" ("calendarToken") WHERE "calendarToken" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_cca9fbe0efa6f6557735260976" ON "orders" ("customRequestId") `);
    await queryRunner.query(`CREATE INDEX "IDX_b9a669ca3382b41ac205dd17b7" ON "orders" ("discountCodeId") `);
    await queryRunner.query(`ALTER TABLE "custom_requests" ADD CONSTRAINT "FK_89cd5b25e48a13f00a9ab6c766d" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "custom_requests" ADD CONSTRAINT "FK_86e1a61088f765580afcde0312e" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "discount_codes" ADD CONSTRAINT "FK_35f2494ce509746ca5c51b32c1d" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "product_views" ADD CONSTRAINT "FK_0eeddd2967d61998a9fb6bc3be0" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_views" DROP CONSTRAINT "FK_0eeddd2967d61998a9fb6bc3be0"`);
    await queryRunner.query(`ALTER TABLE "discount_codes" DROP CONSTRAINT "FK_35f2494ce509746ca5c51b32c1d"`);
    await queryRunner.query(`ALTER TABLE "custom_requests" DROP CONSTRAINT "FK_86e1a61088f765580afcde0312e"`);
    await queryRunner.query(`ALTER TABLE "custom_requests" DROP CONSTRAINT "FK_89cd5b25e48a13f00a9ab6c766d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b9a669ca3382b41ac205dd17b7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cca9fbe0efa6f6557735260976"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_36a0540c646116e1d8c5df22ea"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "autoRepliedAt"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "isAutomatic"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "attachments"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "discountAmount"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "discountCode"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "discountCodeId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customRequestId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "title"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "followersNotifiedAt"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "lowStockThreshold"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "calendarToken"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "holidayStartedAt"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "holidayMessage"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "holidayUntil"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "seats"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "featured"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "compareAtPrice"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "quickReplies"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "capacity"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5cb49a29b30e549bd6ab7cdd1f"`);
    await queryRunner.query(`DROP TABLE "product_views"`);
    await queryRunner.query(`DROP TABLE "discount_codes"`);
    await queryRunner.query(`DROP TYPE "public"."discount_codes_kind_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fccb4e40554aaea605a0bbddf7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3b8843d78349a721b3b404d6a3"`);
    await queryRunner.query(`DROP TABLE "custom_requests"`);
    await queryRunner.query(`DROP TYPE "public"."custom_requests_status_enum"`);
  }
}
