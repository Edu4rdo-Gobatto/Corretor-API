import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { RefreshSession } from './refresh-session.entity';

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService implements OnModuleInit {
  constructor(@InjectRepository(RefreshSession) private readonly sessions: Repository<RefreshSession>) {}

  onModuleInit(): void {
    setInterval(() => void this.purgeExpired(), 60 * 60 * 1000).unref();
  }

  async purgeExpired(): Promise<number> {
    const result = await this.sessions.createQueryBuilder().delete().where('expires_at <= :now', { now: new Date() }).execute();
    return result.affected ?? 0;
  }

  async create(agentId: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    await this.sessions.save(this.sessions.create({ tokenHash: this.hash(token), agentId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE) }));
    return token;
  }

  async consume(token: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{64}$/.test(token)) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    // DELETE RETURNING makes concurrent refreshes single-use across all API instances.
    const result = await this.sessions.createQueryBuilder().delete().where('token_hash = :hash', { hash: this.hash(token) })
      .returning(['agentId', 'expiresAt']).execute();
    const consumed = (result.raw as { agent_id: string; expires_at: Date }[])[0];
    if (!consumed || new Date(consumed.expires_at).getTime() <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    return consumed.agent_id;
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.delete({ tokenHash: this.hash(token) });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
