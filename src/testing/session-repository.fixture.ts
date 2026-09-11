import { DeepPartial } from 'typeorm';
import { RefreshSession } from '../auth/refresh-session.entity';

export class SessionRepositoryFixture {
  readonly sessions = new Map<string, RefreshSession>();
  create(session: DeepPartial<RefreshSession>): RefreshSession {
    return Object.assign(new RefreshSession(), session);
  }
  save(session: RefreshSession): Promise<RefreshSession> {
    this.sessions.set(session.tokenHash, session);
    return Promise.resolve(session);
  }
  delete(criteria: { tokenHash: string }): Promise<void> {
    this.sessions.delete(criteria.tokenHash);
    return Promise.resolve();
  }
  createQueryBuilder() {
    let hash = '';
    const builder = {
      delete: () => builder,
      where: (_expression: string, parameters: { hash: string }) => { hash = parameters.hash; return builder; },
      returning: () => builder,
      execute: () => {
        const session = this.sessions.get(hash);
        this.sessions.delete(hash);
        return Promise.resolve({ raw: session ? [{ agent_id: session.agentId, expires_at: session.expiresAt }] : [] });
      },
    };
    return builder;
  }
}
