import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgents1789084800000 implements MigrationInterface {
  name = 'CreateAgents1789084800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "AgentRole" AS ENUM ('ADMIN', 'AGENT')`);
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "whatsapp_number" text NOT NULL,
        "creci" text,
        "role" "AgentRole" NOT NULL DEFAULT 'AGENT',
        "avatar_url" text,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agents_email" UNIQUE ("email"),
        CONSTRAINT "CHK_agents_email_normalized" CHECK ("email" = lower(btrim("email")))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "agents"');
    await queryRunner.query('DROP TYPE "AgentRole"');
  }
}
