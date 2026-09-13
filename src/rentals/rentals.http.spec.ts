import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent, AgentRole } from '../agents/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { RefreshSession } from '../auth/refresh-session.entity';
import { AgentRepositoryFixture } from '../testing/agent-repository.fixture';
import { SessionRepositoryFixture } from '../testing/session-repository.fixture';
import { RentalPartiesController } from './rental-parties.controller';
import { LeasesController } from './leases.controller';
import { RentalDocumentsController } from './rental-documents.controller';
import { RentalPartiesService } from './rental-parties.service';
import { LeasesService } from './leases.service';
import { RentalDocumentsService } from './rental-documents.service';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';

// Real authentication, role guards, interceptors and DTO pipeline. Storage tested separately.
describe('rental HTTP permission and input boundary', () => {
  let app: INestApplication; let url: string; let admin: Agent; let agent: Agent;
  const agents = new AgentRepositoryFixture();
  const secret = 'rental-http-secret-with-at-least-32-characters';
  const jwt = new JwtService({ secret, signOptions: { issuer: 'corretor-api', audience: 'corretor-web', expiresIn: '15m' } });
  const service = { list: () => ({ items: [], total: 0 }), get: () => ({}), save: (body: unknown) => body, remove: () => undefined, upload: () => ({}), download: () => ({ document: { fileName: 'contrato.pdf', contentType: 'application/pdf' }, bytes: Buffer.from('%PDF-1.7') }) };
  const id = 'b1f0a790-5b20-4380-aa9c-2b084f047df6';
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true, load: [() => ({ JWT_SECRET: secret, JWT_EXPIRES_IN: '15m' })] }), AuthModule],
      controllers: [RentalPartiesController, LeasesController, RentalDocumentsController],
      providers: [RentalPartiesService, LeasesService, RentalDocumentsService].map(provide => ({ provide, useValue: service })),
    }).overrideProvider(getRepositoryToken(Agent)).useValue(agents)
      .overrideProvider(getRepositoryToken(RefreshSession)).useValue(new SessionRepositoryFixture()).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.listen(0, '127.0.0.1'); url = await app.getUrl();
    admin = await agents.save(agents.create({ name: 'Admin', email: 'admin@test.example', role: AgentRole.ADMIN }));
    agent = await agents.save(agents.create({ name: 'Agent', email: 'agent@test.example', role: AgentRole.AGENT }));
  });
  afterAll(async () => { await app?.close(); });
  const request = (path: string, method = 'GET', body?: unknown, account?: Agent) => fetch(`${url}/admin/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(account ? { Authorization: `Bearer ${jwt.sign({ sub: account.id, role: account.role })}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  it.each([
    ['rental-parties','GET'], ['rental-parties','POST'], [`rental-parties/${id}`,'GET'], [`rental-parties/${id}`,'PATCH'],
    ['leases','GET'], ['leases','POST'], [`leases/${id}`,'GET'], [`leases/${id}`,'PATCH'],
    ['rental-documents','GET'], ['rental-documents','POST'], [`rental-documents/${id}`,'DELETE'], [`rental-documents/${id}/download`,'GET'],
  ])('protects %s %s against anonymous and AGENT access', async (path, method) => {
    expect((await request(path, method)).status).toBe(401);
    expect((await request(path, method, undefined, agent)).status).toBe(403);
  });
  it('permits ADMIN and disables caching of private records', async () => {
    const result = await request('rental-parties', 'GET', undefined, admin);
    expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toBe('private, no-store');
  });
  it('rejects missing required fields, unknown fields and null optional values', async () => {
    const invalid = await request('rental-parties', 'POST', { name: 'Maria', unexpected: true }, admin);
    expect(invalid.status).toBe(400);
    const body = await invalid.json() as { message: unknown };
    expect(Array.isArray(body.message) || typeof body.message === 'string').toBe(true);
    const nullValue = await request('rental-parties', 'POST', { kind: 'OWNER', personType: 'PF', name: 'Maria', taxId: '52998224725', email: null }, admin);
    expect(nullValue.status).toBe(400);
  });
  it('rejects malformed pagination, enum values and UUIDs', async () => {
    for (const path of ['rental-parties?limit=1000', 'rental-parties?kind=ADMIN', 'leases?partyId=bad', 'rental-documents?partyId=null', 'rental-parties/not-a-uuid']) {
      expect((await request(path, 'GET', undefined, admin)).status).toBe(400);
    }
  });
  it('downloads as an attachment with no public URL or cache', async () => {
    const result = await request(`rental-documents/${id}/download`, 'GET', undefined, admin);
    expect(result.status).toBe(200); expect(result.headers.get('content-disposition')).toContain('attachment;');
    expect(result.headers.get('cache-control')).toBe('private, no-store'); expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await result.text()).toBe('%PDF-1.7');
  });
});


