import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshSessions1789084804000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE refresh_sessions (
      token_hash text PRIMARY KEY,
      agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    )`);
    await queryRunner.query('CREATE INDEX idx_refresh_sessions_expiry ON refresh_sessions(expires_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE refresh_sessions');
  }
}
