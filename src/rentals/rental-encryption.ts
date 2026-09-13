import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ValueTransformer } from 'typeorm';
function key() {
  const secret = process.env.LEADS_ENCRYPTION_KEY;
  if (!secret) throw new Error('LEADS_ENCRYPTION_KEY não configurada.');
  return createHash('sha256').update('rental-administration:v1:').update(secret).digest();
}
export const rentalEncryption: ValueTransformer = {
  to(value: unknown): string {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return `rental:v1:${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
  },
  from(value: string): unknown {
    if (!value.startsWith('rental:v1:')) throw new Error('Formato de dados privados inválido.');
    const [iv, tag, data] = value.slice(10).split('.');
    const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    cipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, 'base64url')), cipher.final()]).toString('utf8')) as unknown;
  },
};
