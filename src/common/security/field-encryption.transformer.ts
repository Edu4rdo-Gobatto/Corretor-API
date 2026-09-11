import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { ValueTransformer } from 'typeorm';

const prefix = 'enc:v1:';
function key(): Buffer {
  const secret = process.env.LEADS_ENCRYPTION_KEY;
  if (!secret) throw new Error('LEADS_ENCRYPTION_KEY não configurada.');
  return createHash('sha256').update(secret).digest();
}
export const encryptedTextTransformer: ValueTransformer = {
  to(value: string | null): string | null {
    if (value === null || value === undefined || value.startsWith(prefix)) return value;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${prefix}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  },
  from(value: string | null): string | null {
    if (value === null || value === undefined || !value.startsWith(prefix)) return value;
    const [ivText, tagText, encryptedText] = value.slice(prefix.length).split('.');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
  },
};
