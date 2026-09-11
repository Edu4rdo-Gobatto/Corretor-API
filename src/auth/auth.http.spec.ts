import { RefreshSession } from '../auth/refresh-session.entity';
import { SessionRepositoryFixture } from '../testing/session-repository.fixture';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash, verify } from 'argon2';
import { Agent, AgentRole } from '../agents/agent.entity';
import { AgentRepositoryFixture } from '../testing/agent-repository.fixture';
import { AuthModule } from './auth.module';

describe('authentication HTTP contract (database boundary replaced)', () => {
  let application: INestApplication;
  let baseUrl: string;
  const repository = new AgentRepositoryFixture();
  const secret = 'test-only-jwt-secret-with-more-than-32-characters';
  const jwt = new JwtService({ secret, signOptions: { issuer: 'corretor-api', audience: 'corretor-web', expiresIn: '7d' } });
  let administrator: Agent;
  let agent: Agent;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true,
          load: [() => ({ JWT_SECRET: secret, JWT_EXPIRES_IN: '7d' })] }),
        AuthModule,
      ],
    }).overrideProvider(getRepositoryToken(RefreshSession)).useValue(new SessionRepositoryFixture()).overrideProvider(getRepositoryToken(Agent)).useValue(repository).compile();
    application = module.createNestApplication();
    application.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await application.listen(0, '127.0.0.1');
    baseUrl = await application.getUrl();
  });

  beforeEach(async () => {
    repository.agents.clear();
    const passwordHash = await hash('correct-test-password');
    administrator = await repository.save(repository.create({
      name: 'Administrator', email: 'admin@example.com', passwordHash,
      whatsappNumber: '5565999999999', role: AgentRole.ADMIN,
    }));
    agent = await repository.save(repository.create({
      name: 'Agent', email: 'agent@example.com', passwordHash, whatsappNumber: '5565988888888',
    }));
  });

  afterAll(async () => { await application?.close(); });

  function request(path: string, method = 'GET', body?: unknown, token?: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function tokenFor(account: Agent, overrides: Record<string, unknown> = {}): string {
    return jwt.sign({ sub: account.id, role: account.role, ...overrides });
  }

  it('logs in with normalized email and returns a signed token without password material', async () => {
    const response = await request('/auth/login', 'POST', { email: ' ADMIN@EXAMPLE.COM ', password: 'correct-test-password' });
    expect(response.status).toBe(200);
    const body = await response.json() as { accessToken: string; agent: { id: string }; tokenType: string };
    expect(jwt.verify<Record<string, unknown>>(body.accessToken)).toMatchObject({ sub: administrator.id, role: 'ADMIN' });
    expect(body.agent.id).toBe(administrator.id);
    expect(body.tokenType).toBe('Bearer');
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('$argon2');
  });

  it.each([
    ['admin@example.com', 'wrong-password'],
    ['unknown@example.com', 'correct-test-password'],
  ])('rejects bad credentials for %s with the same response', async (email, password) => {
    const response = await request('/auth/login', 'POST', { email, password });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ message: 'E-mail ou senha inválidos.' });
  });

  it('refuses login and existing tokens for an inactive account', async () => {
    administrator.active = false;
    expect((await request('/auth/login', 'POST', { email: administrator.email, password: 'correct-test-password' })).status).toBe(401);
    expect((await request('/auth/me', 'GET', undefined, tokenFor(administrator))).status).toBe(401);
  });

  it('returns the current profile without the hash', async () => {
    const response = await request('/auth/me', 'GET', undefined, tokenFor(agent));
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ id: agent.id, role: 'AGENT', email: 'agent@example.com' });
    expect(JSON.stringify(body)).not.toContain('password');
  });

  it('rejects missing, altered, expired, malformed and deleted-account tokens', async () => {
    const otherSigner = new JwtService({ secret: 'other-signing-secret' });
    const tokens = [undefined, otherSigner.sign({ sub: agent.id }), tokenFor(agent, { iat: 1 }), tokenFor(agent, { sub: 'invalid-id' })];
    for (const token of tokens) expect((await request('/auth/me', 'GET', undefined, token)).status).toBe(401);
    repository.agents.delete(agent.id);
    expect((await request('/auth/me', 'GET', undefined, tokenFor(agent))).status).toBe(401);
  });

  const newAgent = {
    name: 'New agent', email: 'NEW@example.com', password: 'new-agent-test-password',
    whatsappNumber: '5565977777777', creci: '12345',
  };

  it('allows ADMIN to create an agent, hashes the password, and permits subsequent login', async () => {
    const response = await request('/agents', 'POST', newAgent, tokenFor(administrator));
    expect(response.status).toBe(201);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ name: 'New agent', email: 'new@example.com', role: 'AGENT', active: true });
    expect(JSON.stringify(body)).not.toContain('password');
    const stored = await repository.findOneBy({ email: 'new@example.com' });
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(stored!.passwordHash, newAgent.password)).toBe(true);
    expect((await request('/auth/login', 'POST', { email: newAgent.email, password: newAgent.password })).status).toBe(200);
  });

  it('rejects unauthenticated and AGENT account creation', async () => {
    expect((await request('/agents', 'POST', newAgent)).status).toBe(401);
    expect((await request('/agents', 'POST', newAgent, tokenFor(agent))).status).toBe(403);
    expect(repository.agents.size).toBe(2);
  });

  it('uses the current database role even when a token contains an old ADMIN role', async () => {
    const token = tokenFor(administrator);
    administrator.role = AgentRole.AGENT;
    expect((await request('/agents', 'POST', newAgent, token)).status).toBe(403);
  });

  it('rejects duplicate normalized email with 409', async () => {
    const response = await request('/agents', 'POST', { ...newAgent, email: ' ADMIN@EXAMPLE.COM ' }, tokenFor(administrator));
    expect(response.status).toBe(409);
    expect(repository.agents.size).toBe(2);
  });

  it.each([
    { email: 'bad-email' }, { password: 'short' }, { name: '   ' },
    { whatsappNumber: '+55 (65) 99999-9999' }, { role: 'OWNER' }, { role: null },
    { passwordHash: 'do-not-accept-hashes' }, { active: false },
  ])('validates agent input %j before persistence', async (invalidFields) => {
    const response = await request('/agents', 'POST', { ...newAgent, ...invalidFields }, tokenFor(administrator));
    expect(response.status).toBe(400);
    expect(repository.agents.size).toBe(2);
    expect(JSON.stringify(await response.json())).not.toContain('new-agent-test-password');
  });

  it('rejects invalid login payloads', async () => {
    expect((await request('/auth/login', 'POST', { email: 'bad', password: 'password' })).status).toBe(400);
    expect((await request('/auth/login', 'POST', { email: agent.email })).status).toBe(400);
  });
describe('browser session security', () => {
  it('rejects untrusted browser origins before login', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ email: administrator.email, password: 'correct-test-password' }) });
    expect(response.status).toBe(403);
  });
  it('rotates refresh cookies and refuses replay and revoked sessions', async () => {
    const login = await request('/auth/login', 'POST', { email: administrator.email, password: 'correct-test-password' });
    const cookie = login.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const refresh = (value: string) => fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { Cookie: value.split(';')[0] } });
    const renewed = await refresh(cookie);
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toHaveProperty('accessToken');
    expect((await refresh(cookie)).status).toBe(401);
    const nextCookie = renewed.headers.get('set-cookie')!;
    const logout = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { Cookie: nextCookie.split(';')[0] } });
    expect(logout.status).toBe(204);
    expect((await refresh(nextCookie)).status).toBe(401);
  });
  it('restricts listing and updates to administrators', async () => {
    expect((await request('/agents', 'GET', undefined, tokenFor(agent))).status).toBe(403);
    expect((await request(`/agents/${agent.id}`, 'PATCH', { active: false }, tokenFor(agent))).status).toBe(403);
    const listing = await request('/agents', 'GET', undefined, tokenFor(administrator));
    expect(listing.status).toBe(200);
    expect(await listing.json()).toMatchObject({ total: 2, page: 1 });
    expect((await request(`/agents/${administrator.id}`, 'PATCH', { active: false }, tokenFor(administrator))).status).toBe(409);
    expect((await request(`/agents/${agent.id}`, 'PATCH', { active: false }, tokenFor(administrator))).status).toBe(200);
    expect((await request('/auth/me', 'GET', undefined, tokenFor(agent))).status).toBe(401);
  });
  it('preserves role on profile edits and validates account changes', async () => {
    const edited = await request(`/agents/${administrator.id}`, 'PATCH', { name: 'Admin updated' }, tokenFor(administrator));
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ name: 'Admin updated', role: 'ADMIN' });
    expect((await request(`/agents/${administrator.id}`, 'PATCH', { role: 'AGENT' }, tokenFor(administrator))).status).toBe(409);
    expect((await request(`/agents/${agent.id}`, 'PATCH', { active: null }, tokenFor(administrator))).status).toBe(400);
    expect((await request(`/agents/${agent.id}`, 'PATCH', { password: 'short' }, tokenFor(administrator))).status).toBe(400);
  });
  it('refuses renewal after account deactivation', async () => {
    const login = await request('/auth/login', 'POST', { email: agent.email, password: 'correct-test-password' });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    agent.active = false;
    const refresh = await fetch(`${baseUrl}/auth/refresh`, { method: 'POST', headers: { Cookie: cookie } });
    expect(refresh.status).toBe(401);
  });
});

});
