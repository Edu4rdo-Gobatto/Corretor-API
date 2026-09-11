import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePropertyMedia1789084802000 implements MigrationInterface {
  name = 'CreatePropertyMedia1789084802000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO_EMBED', 'VIDEO_FILE')`);
    await queryRunner.query(`
      CREATE TABLE "property_media" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "property_id" uuid NOT NULL,
        "type" "MediaType" NOT NULL,
        "url" text NOT NULL,
        "storage_key" text,
        "order_index" integer NOT NULL DEFAULT 0,
        "is_cover" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_property_media" PRIMARY KEY ("id"),
        CONSTRAINT "FK_property_media_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_property_media_property_order" ON "property_media" ("property_id", "order_index")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "property_media"');
    await queryRunner.query('DROP TYPE "MediaType"');
  }
}
