import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline: the full schema as defined by the entities when migrations were
 * re-established. Replaces the earlier migrations, which had drifted from the
 * entities (they created a "user" table and nothing for orders/products/etc.).
 *
 * Databases that were already built by `synchronize` have this schema, so
 * on those it only records itself as applied and changes nothing. Run
 * `npm run migration:check` afterwards to confirm there's no drift.
 */
export class Baseline1793948217831 implements MigrationInterface {
  name = "Baseline1793948217831";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("users")) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "iconUrl" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "price" numeric(10,2) NOT NULL, "duration" character varying, "isAvailable" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "shopId" uuid, CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('artisan', 'client', 'super_admin')`);
    await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "email" character varying NOT NULL, "phone" character varying NOT NULL, "password" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "role" "public"."users_role_enum" NOT NULL DEFAULT 'client', "avatarUrl" character varying, "resetPasswordTokenHash" character varying, "resetPasswordExpiresAt" TIMESTAMP WITH TIME ZONE, "acceptedTermsAt" TIMESTAMP WITH TIME ZONE, "passwordChangedAt" TIMESTAMP WITH TIME ZONE, "failedLoginAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "comment" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "authorId" uuid, "shopId" uuid, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "publicId" character varying, "caption" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "shopId" uuid, CONSTRAINT "PK_5220c45b8e32d49d767b9b3d725" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'cancelled', 'completed')`);
    await queryRunner.query(`CREATE TYPE "public"."bookings_paymentstatus_enum" AS ENUM('unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed')`);
    await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scheduledAt" TIMESTAMP NOT NULL, "notes" text, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "totalAmount" numeric(10,2) NOT NULL, "paymentStatus" "public"."bookings_paymentstatus_enum" NOT NULL DEFAULT 'unpaid', "stripePaymentIntentId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "clientId" uuid, "shopId" uuid, "serviceId" uuid, CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "product_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "publicId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "productId" uuid, CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "variant_options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "productId" uuid, CONSTRAINT "PK_378f9c60fc48041979a856e7711" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "variant_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "value" character varying NOT NULL, "priceModifier" numeric(10,2) NOT NULL DEFAULT '0', "optionId" uuid, CONSTRAINT "PK_fedcedfc410acbd14525bd3791c" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sku" character varying, "stockQuantity" integer NOT NULL DEFAULT '0', "priceOverride" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "productId" uuid, CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "basePrice" numeric(10,2) NOT NULL DEFAULT '0', "imageUrl" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "shopId" uuid, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."shops_status_enum" AS ENUM('active', 'suspended', 'pending', 'closed')`);
    await queryRunner.query(`CREATE TYPE "public"."shops_verificationstatus_enum" AS ENUM('none', 'pending', 'verified', 'rejected')`);
    await queryRunner.query(`CREATE TABLE "shops" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shopName" character varying NOT NULL, "description" character varying, "address" character varying, "city" character varying, "logoUrl" character varying, "phone" character varying, "status" "public"."shops_status_enum" NOT NULL DEFAULT 'pending', "averageRating" double precision NOT NULL DEFAULT '0', "verificationStatus" "public"."shops_verificationstatus_enum" NOT NULL DEFAULT 'none', "verificationNote" text, "stripeAccountId" character varying, "stripeOnboardingComplete" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid, "categoryId" uuid, CONSTRAINT "REL_9f222a91f08322c9d08a1b443b" UNIQUE ("ownerId"), CONSTRAINT "PK_3c6aaa6607d287de99815e60b96" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('pending', 'fulfilled', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "public"."orders_paymentstatus_enum" AS ENUM('unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed')`);
    await queryRunner.query(`CREATE TYPE "public"."orders_deliverymethod_enum" AS ENUM('pickup', 'delivery')`);
    await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL DEFAULT '1', "totalAmount" numeric(10,2) NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending', "paymentStatus" "public"."orders_paymentstatus_enum" NOT NULL DEFAULT 'unpaid', "stripePaymentIntentId" character varying, "checkoutGroupId" character varying, "deliveryMethod" "public"."orders_deliverymethod_enum" NOT NULL DEFAULT 'pickup', "shippingAddress" text, "trackingInfo" character varying, "variantLabel" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "clientId" uuid, "shopId" uuid, "productId" uuid, "variantId" uuid, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "processed_webhook_events" ("id" character varying NOT NULL, "processedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_80f4f20ca1cace20dd6e3a714c1" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "conversationId" uuid, "senderId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "clientId" uuid, "shopId" uuid, CONSTRAINT "UQ_1bcca97909ebf3ee284b74dde6b" UNIQUE ("clientId", "shopId"), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."reports_targettype_enum" AS ENUM('shop', 'product', 'service', 'review')`);
    await queryRunner.query(`CREATE TYPE "public"."reports_status_enum" AS ENUM('pending', 'dismissed', 'actioned')`);
    await queryRunner.query(`CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "targetType" "public"."reports_targettype_enum" NOT NULL, "targetId" character varying NOT NULL, "targetLabel" character varying, "reason" text NOT NULL, "status" "public"."reports_status_enum" NOT NULL DEFAULT 'pending', "adminNote" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "reporterId" uuid, CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."disputes_targettype_enum" AS ENUM('booking', 'order')`);
    await queryRunner.query(`CREATE TYPE "public"."disputes_status_enum" AS ENUM('open', 'resolved_refunded', 'resolved_denied', 'resolved_other')`);
    await queryRunner.query(`CREATE TABLE "disputes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "targetType" "public"."disputes_targettype_enum" NOT NULL, "targetId" character varying NOT NULL, "reason" text NOT NULL, "status" "public"."disputes_status_enum" NOT NULL DEFAULT 'open', "resolutionNote" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "raisedById" uuid, CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."favorites_targettype_enum" AS ENUM('shop', 'product')`);
    await queryRunner.query(`CREATE TABLE "favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "targetType" "public"."favorites_targettype_enum" NOT NULL, "targetId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "UQ_0fee0d2ed431ff97cf4253b388c" UNIQUE ("userId", "targetType", "targetId"), CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "product_variant_values" ("productVariantsId" uuid NOT NULL, "variantValuesId" uuid NOT NULL, CONSTRAINT "PK_10620bd2011ce3e12b3e449a041" PRIMARY KEY ("productVariantsId", "variantValuesId"))`);
    await queryRunner.query(`CREATE INDEX "IDX_d47ac48f647c8a99e69f633194" ON "product_variant_values" ("productVariantsId") `);
    await queryRunner.query(`CREATE INDEX "IDX_6fbdc8dba3573dd2dca6afa6e2" ON "product_variant_values" ("variantValuesId") `);
    await queryRunner.query(`ALTER TABLE "services" ADD CONSTRAINT "FK_e773bd43e120f8a21f795b91502" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_48770372f891b9998360e4434f3" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_8a03915becde062dcf240a0ead4" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "photos" ADD CONSTRAINT "FK_bdef559142a43d73c8b4d618ec0" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_ea203405627b9fb15023dd75661" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_56a17e5244711d61bb98e8275e7" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_15a2431ec10d29dcd96c9563b65" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "product_images" ADD CONSTRAINT "FK_b367708bf720c8dd62fc6833161" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "variant_options" ADD CONSTRAINT "FK_838991b1415fa80037f6bc3d365" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "variant_values" ADD CONSTRAINT "FK_edcba1e6e38f0fccec3cfbd56a0" FOREIGN KEY ("optionId") REFERENCES "variant_options"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_f515690c571a03400a9876600b5" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_51a281693ebef6fa8729de39381" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "shops" ADD CONSTRAINT "FK_9f222a91f08322c9d08a1b443b8" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "shops" ADD CONSTRAINT "FK_23a2da036629bb4ad2940e7e79c" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_1457f286d91f271313fded23e53" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_7fc658e494680d44c3cc59b31b4" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_8624dad595ae567818ad9983b33" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_66347bbf5e07114999aac1aae19" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_2882c536d4eecfd496132b20eeb" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_de1572a6f7605ea6150d95b4c85" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_4353be8309ce86650def2f8572d" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_8880a40e54bc9b4675323ca102e" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_e747534006c6e3c2f09939da60f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "product_variant_values" ADD CONSTRAINT "FK_d47ac48f647c8a99e69f6331947" FOREIGN KEY ("productVariantsId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "product_variant_values" ADD CONSTRAINT "FK_6fbdc8dba3573dd2dca6afa6e2b" FOREIGN KEY ("variantValuesId") REFERENCES "variant_values"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_variant_values" DROP CONSTRAINT "FK_6fbdc8dba3573dd2dca6afa6e2b"`);
    await queryRunner.query(`ALTER TABLE "product_variant_values" DROP CONSTRAINT "FK_d47ac48f647c8a99e69f6331947"`);
    await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_e747534006c6e3c2f09939da60f"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_8880a40e54bc9b4675323ca102e"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_4353be8309ce86650def2f8572d"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_de1572a6f7605ea6150d95b4c85"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_2882c536d4eecfd496132b20eeb"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_66347bbf5e07114999aac1aae19"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_8624dad595ae567818ad9983b33"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_7fc658e494680d44c3cc59b31b4"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_1457f286d91f271313fded23e53"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP CONSTRAINT "FK_23a2da036629bb4ad2940e7e79c"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP CONSTRAINT "FK_9f222a91f08322c9d08a1b443b8"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_51a281693ebef6fa8729de39381"`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_f515690c571a03400a9876600b5"`);
    await queryRunner.query(`ALTER TABLE "variant_values" DROP CONSTRAINT "FK_edcba1e6e38f0fccec3cfbd56a0"`);
    await queryRunner.query(`ALTER TABLE "variant_options" DROP CONSTRAINT "FK_838991b1415fa80037f6bc3d365"`);
    await queryRunner.query(`ALTER TABLE "product_images" DROP CONSTRAINT "FK_b367708bf720c8dd62fc6833161"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_15a2431ec10d29dcd96c9563b65"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_56a17e5244711d61bb98e8275e7"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_ea203405627b9fb15023dd75661"`);
    await queryRunner.query(`ALTER TABLE "photos" DROP CONSTRAINT "FK_bdef559142a43d73c8b4d618ec0"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_8a03915becde062dcf240a0ead4"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_48770372f891b9998360e4434f3"`);
    await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "FK_e773bd43e120f8a21f795b91502"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6fbdc8dba3573dd2dca6afa6e2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d47ac48f647c8a99e69f633194"`);
    await queryRunner.query(`DROP TABLE "product_variant_values"`);
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(`DROP TYPE "public"."favorites_targettype_enum"`);
    await queryRunner.query(`DROP TABLE "disputes"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_targettype_enum"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_targettype_enum"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "processed_webhook_events"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_deliverymethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "shops"`);
    await queryRunner.query(`DROP TYPE "public"."shops_verificationstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shops_status_enum"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "product_variants"`);
    await queryRunner.query(`DROP TABLE "variant_values"`);
    await queryRunner.query(`DROP TABLE "variant_options"`);
    await queryRunner.query(`DROP TABLE "product_images"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "photos"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
