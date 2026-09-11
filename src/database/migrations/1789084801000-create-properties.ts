import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProperties1789084801000 implements MigrationInterface {
  name = 'CreateProperties1789084801000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "PropertyType" AS ENUM ('GALPAO', 'SALA', 'PREDIO', 'LOJA', 'TERRENO')`);
    await queryRunner.query(`CREATE TYPE "PropertyPurpose" AS ENUM ('LOCACAO', 'VENDA')`);
    await queryRunner.query(`CREATE TYPE "PropertyStatus" AS ENUM ('DISPONIVEL', 'RESERVADO', 'CONCLUIDO')`);
    await queryRunner.query(`
      CREATE TABLE "properties" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" text NOT NULL,
        "slug" text NOT NULL,
        "type" "PropertyType" NOT NULL,
        "purpose" "PropertyPurpose" NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "condo_fee" numeric(10,2),
        "iptu_fee" numeric(10,2),
        "usable_area" numeric(10,2) NOT NULL,
        "total_area" numeric(10,2) NOT NULL,
        "address_street" text NOT NULL,
        "address_number" text NOT NULL,
        "address_city" text NOT NULL,
        "address_state" text NOT NULL,
        "neighborhood" text NOT NULL,
        "description" text NOT NULL,
        "features" jsonb NOT NULL DEFAULT '{}',
        "status" "PropertyStatus" NOT NULL DEFAULT 'DISPONIVEL',
        "agent_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_properties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_properties_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_properties_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_properties_areas" CHECK ("usable_area" > 0 AND "total_area" >= "usable_area"),
        CONSTRAINT "CHK_properties_prices" CHECK ("price" >= 0 AND ("condo_fee" IS NULL OR "condo_fee" >= 0) AND ("iptu_fee" IS NULL OR "iptu_fee" >= 0))
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_properties_agent_id" ON "properties" ("agent_id")');
    await queryRunner.query('CREATE INDEX "IDX_properties_public_created" ON "properties" ("status", "created_at")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "properties"');
    await queryRunner.query('DROP TYPE "PropertyStatus"');
    await queryRunner.query('DROP TYPE "PropertyPurpose"');
    await queryRunner.query('DROP TYPE "PropertyType"');
  }
}
