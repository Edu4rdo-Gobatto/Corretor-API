import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeads1789084803000 implements MigrationInterface {
  name = 'CreateLeads1789084803000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "leads" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "property_id" uuid,
        "agent_id" uuid NOT NULL,
        "lead_name" text NOT NULL,
        "lead_phone" text NOT NULL,
        "lead_email" text,
        "message" text,
        "consent_given" boolean NOT NULL,
        "consent_timestamp" timestamptz NOT NULL,
        "consent_ip" text NOT NULL,
        "terms_version" text NOT NULL DEFAULT 'v1.0',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leads" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leads_property" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_leads_agent" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_leads_agent_created" ON "leads" ("agent_id", "created_at")');
    await queryRunner.query('CREATE INDEX "IDX_leads_property_created" ON "leads" ("property_id", "created_at")');
    await queryRunner.query('CREATE INDEX "IDX_leads_created_at" ON "leads" ("created_at")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "leads"');
  }
}
