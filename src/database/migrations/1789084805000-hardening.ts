import { MigrationInterface, QueryRunner } from 'typeorm';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

export class Hardening1789084805000 implements MigrationInterface {
  name = 'Hardening1789084805000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_properties_city_trgm" ON "properties" USING gin ("address_city" gin_trgm_ops)');
    const secret = process.env.LEADS_ENCRYPTION_KEY;
    if (!secret) throw new Error('LEADS_ENCRYPTION_KEY é obrigatória para executar a migração.');
    const key = createHash('sha256').update(secret).digest();
    const rows = (await queryRunner.query('SELECT id, lead_name, lead_phone, lead_email FROM leads')) as unknown as Array<{ id: string; lead_name: string; lead_phone: string; lead_email: string | null }>;
    for (const row of rows) {
      const encrypt = (value: string | null) => {
        if (value === null || value.startsWith('enc:v1:')) return value;
        const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
        return `enc:v1:${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
      };
      await queryRunner.query('UPDATE leads SET lead_name=$1, lead_phone=$2, lead_email=$3 WHERE id=$4', [encrypt(row.lead_name), encrypt(row.lead_phone), encrypt(row.lead_email), row.id]);
    }
  }
  async down(): Promise<void> { /* Encryption is intentionally not reversed automatically. */ }
}

