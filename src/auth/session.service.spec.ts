import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { SessionRepositoryFixture } from '../testing/session-repository.fixture';
import { LoginRateGuard } from './login-rate.guard';
import { RefreshSession } from './refresh-session.entity';
import { SessionService } from './session.service';

describe('refresh token lifecycle', () => {
  it('generates PostgreSQL DELETE RETURNING using mapped column names', async () => {
    class OfflineDataSource extends DataSource {
      prepareMetadata() { return this.buildMetadatas(); }
    }
    const source = new OfflineDataSource({ type: 'postgres', entities: [RefreshSession] });
    await source.prepareMetadata();
    const actualRepository = source.getRepository(RefreshSession);
    const builder = actualRepository.createQueryBuilder();
    const deletion = builder.delete();
    jest.spyOn(builder, 'delete').mockReturnValue(deletion);
    const execute = jest.spyOn(deletion, 'execute').mockImplementation(() => {
      expect(deletion.getSql()).toContain('RETURNING "agent_id", "expires_at"');
      return Promise.resolve({ raw: [{ agent_id: 'agent-id', expires_at: new Date(Date.now() + 10000) }], affected: 1 });
    });
    jest.spyOn(actualRepository, 'createQueryBuilder').mockReturnValue(builder);
    await expect(new SessionService(actualRepository).consume('x'.repeat(64))).resolves.toBe('agent-id');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  let repository: SessionRepositoryFixture;
  let sessions: SessionService;
  beforeEach(() => {
    repository = new SessionRepositoryFixture();
    sessions = new SessionService(repository as unknown as Repository<RefreshSession>);
  });
  it('persists only a token hash and allows just one concurrent consumer', async () => {
    const token = await sessions.create('agent-id');
    expect([...repository.sessions.keys()]).toEqual([createHash('sha256').update(token).digest('hex')]);
    expect(JSON.stringify([...repository.sessions.values()])).not.toContain(token);
    const results = await Promise.allSettled([sessions.consume(token), sessions.consume(token)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });
  it('rejects expired and malformed refresh tokens', async () => {
    const token = await sessions.create('agent-id');
    for (const session of repository.sessions.values()) session.expiresAt = new Date(0);
    await expect(sessions.consume(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(sessions.consume('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('login attempt limits', () => {
  const context = (email: string, ip = '127.0.0.1') => ({
    switchToHttp: () => ({ getRequest: () => ({ ip, socket: {}, body: { email } }) }),
  }) as unknown as ExecutionContext;
  it('limits normalized account attempts even across IPs and expires the window', () => {
    const guard = new LoginRateGuard();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      for (let attempt = 0; attempt < 10; attempt++) expect(guard.canActivate(context('TEST@example.com', String(attempt)))).toBe(true);
      expect(() => guard.canActivate(context(' test@example.com ', 'another-ip'))).toThrow(HttpException);
      now.mockReturnValue(1000 + 15 * 60 * 1000);
      expect(guard.canActivate(context('test@example.com'))).toBe(true);
    } finally { now.mockRestore(); }
  });
  it('limits one IP trying many accounts', () => {
    const guard = new LoginRateGuard();
    for (let attempt = 0; attempt < 50; attempt++) guard.canActivate(context(`user${attempt}@example.com`));
    expect(() => guard.canActivate(context('fresh@example.com'))).toThrow(HttpException);
  });
});
