import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserTable1777665143241 implements MigrationInterface {
  name = "CreateUserTable1777665143241";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
      "name" character varying(100) NOT NULL, 
      "email" character varying NOT NULL, 
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), 
      CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
