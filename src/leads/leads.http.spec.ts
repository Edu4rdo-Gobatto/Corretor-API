import { RefreshSession } from '../auth/refresh-session.entity';
import { SessionRepositoryFixture } from '../testing/session-repository.fixture';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent, AgentRole } from '../agents/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { Property, PropertyPurpose, PropertyStatus, PropertyType } from '../properties/property.entity';
import { AgentRepositoryFixture } from '../testing/agent-repository.fixture';
import { PropertyRepositoryFixture } from '../testing/property-repository.fixture';
import { LeadRepositoryFixture } from '../testing/lead-repository.fixture';
import { Lead } from './lead.entity';
import { LeadsModule } from './leads.module';

describe('lead HTTP contract', () => {
  let application: INestApplication;
  let baseUrl: string;
  const agents = new AgentRepositoryFixture();
  const properties = new PropertyRepositoryFixture(agents);
  const leads = new LeadRepositoryFixture(agents, properties);
  const secret = 'leads-test-secret-with-more-than-32-characters';
  const jwt = new JwtService({ secret, signOptions: { issuer: 'corretor-api', audience: 'corretor-web', expiresIn: '7d' } });
  let owner: Agent;
  let other: Agent;
  let admin: Agent;
  let property!: Property;
  let otherProperty!: Property;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true,
        load: [() => ({ JWT_SECRET: secret, JWT_EXPIRES_IN: '7d' })] }),
      AuthModule, LeadsModule,
    ] })
      .overrideProvider(getRepositoryToken(RefreshSession)).useValue(new SessionRepositoryFixture()).overrideProvider(getRepositoryToken(Agent)).useValue(agents)
      .overrideProvider(getRepositoryToken(Property)).useValue(properties)
      .overrideProvider(getRepositoryToken(Lead)).useValue(leads)
      .compile();
    application = module.createNestApplication();
    const httpServer = application.getHttpAdapter().getInstance() as { set: (setting: string, value: number) => void };
    httpServer.set('trust proxy', 1);
    application.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await application.listen(0, '127.0.0.1');
    baseUrl = await application.getUrl();
  });

  beforeEach(async () => {
    agents.agents.clear(); properties.properties.clear(); leads.leads.clear();
    owner = await agents.save(agents.create({ name: 'Owner', email: 'owner@example.com', whatsappNumber: '5565999999999' }));
    other = await agents.save(agents.create({ name: 'Other', email: 'other@example.com', whatsappNumber: '5565988888888' }));
    admin = await agents.save(agents.create({ name: 'Admin', email: 'admin@example.com', role: AgentRole.ADMIN }));
    property = await properties.save(properties.create({
      title: 'Galpão do Owner', slug: 'galpao-owner', type: PropertyType.GALPAO, purpose: PropertyPurpose.LOCACAO, price: 12000,
      usableArea: 500, totalArea: 600, addressStreet: 'Rua A', addressNumber: '10', addressCity: 'Cuiabá',
      addressState: 'MT', neighborhood: 'Centro', description: 'Imóvel', agentId: owner.id,
    }));
    otherProperty = await properties.save(properties.create({
      title: 'Sala do Other', slug: 'sala-other', type: PropertyType.SALA, purpose: PropertyPurpose.VENDA, price: 300000,
      usableArea: 50, totalArea: 60, addressStreet: 'Rua B', addressNumber: '20', addressCity: 'Rondonópolis',
      addressState: 'MT', neighborhood: 'Centro', description: 'Imóvel', agentId: other.id,
    }));
  });

  afterAll(async () => { await application?.close(); });

  function request(path: string, method = 'GET', body?: unknown, account?: Agent, ip?: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { method, headers: {
      'Content-Type': 'application/json',
      ...(account ? { Authorization: `Bearer ${jwt.sign({ sub: account.id, role: account.role })}` } : {}),
      ...(ip ? { 'X-Forwarded-For': ip } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  function leadInput(propertyId = property.id, overrides = {}) {
    return { propertyId, leadName: 'Cliente Teste', leadPhone: '5565999999999', leadEmail: 'cliente@example.com',
      message: 'Tenho interesse.', consentGiven: true, ...overrides };
  }

  it('rejects a lead without consent before persistence', async () => {
    const response = await request('/leads', 'POST', leadInput(property.id, { consentGiven: false }));
    expect(response.status).toBe(400);
    expect(leads.leads.size).toBe(0);
  });

  it('creates a consented lead with audit fields and property owner assignment', async () => {
    const response = await request('/leads', 'POST', leadInput(), undefined, '203.0.113.10');
    expect(response.status).toBe(201);
    const body = await response.json() as Lead;
    expect(body).toMatchObject({ propertyId: property.id, agentId: owner.id, leadName: 'Cliente Teste',
      leadEmail: 'cliente@example.com', consentGiven: true, consentIp: '203.0.113.10', termsVersion: 'v1.0' });
    expect(body.consentTimestamp).toBeTruthy();
    expect(leads.leads.size).toBe(1);
  });

  it('rejects a missing property', async () => {
    const response = await request('/leads', 'POST', leadInput('00000000-0000-4000-8000-000000000099'));
    expect(response.status).toBe(400);
    expect(leads.leads.size).toBe(0);
  });

  it('rejects an unavailable property', async () => {
    property.status = PropertyStatus.RESERVADO;
    const response = await request('/leads', 'POST', leadInput());
    expect(response.status).toBe(400);
    expect(leads.leads.size).toBe(0);
  });

  it.each([
    { leadName: ' ' }, { leadPhone: '123' }, { leadEmail: 'invalid' }, { message: ' ' },
    { propertyId: 'not-a-uuid' }, { consentGiven: 'true' },
  ])('rejects invalid lead input %j', async (invalid) => {
    expect((await request('/leads', 'POST', leadInput(property.id, invalid))).status).toBe(400);
    expect(leads.leads.size).toBe(0);
  });

  it('requires authentication to list and delete leads', async () => {
    expect((await request('/admin/leads')).status).toBe(401);
    expect((await request(`/admin/leads/${property.id}`, 'DELETE')).status).toBe(401);
  });

  it('lists only the owner leads while ADMIN sees all with filters and pagination', async () => {
    await request('/leads', 'POST', leadInput(property.id, { leadName: 'Alpha', leadPhone: '5511111111111' }));
    await request('/leads', 'POST', leadInput(otherProperty.id, { leadName: 'Beta', leadPhone: '5522222222222' }));
    expect(await (await request('/admin/leads', 'GET', undefined, owner)).json()).toMatchObject({ total: 1, items: [expect.objectContaining({ leadName: 'Alpha' })] });
    expect(await (await request('/admin/leads', 'GET', undefined, admin)).json()).toMatchObject({ total: 2 });
    const filtered = await request(`/admin/leads?propertyId=${property.id}&search=alpha&page=1&limit=1`, 'GET', undefined, admin);
    expect(filtered.status).toBe(200);
    expect(await filtered.json()).toMatchObject({ total: 1, page: 1, limit: 1, totalPages: 1, items: [expect.objectContaining({ leadName: 'Alpha' })] });
  });

  it('filters leads by creation interval', async () => {
    await request('/leads', 'POST', leadInput());
    const createdAt = [...leads.leads.values()][0].createdAt.toISOString();
    const response = await request(`/admin/leads?createdFrom=${encodeURIComponent(createdAt)}&createdTo=${encodeURIComponent(createdAt)}`, 'GET', undefined, owner);
    expect(response.status).toBe(200);
    expect((await response.json() as { total: number }).total).toBe(1);
  });

  it('prevents cross-owner deletion, permits ADMIN deletion, and hard deletes', async () => {
    const created = await (await request('/leads', 'POST', leadInput())).json() as Lead;
    expect((await request(`/admin/leads/${created.id}`, 'DELETE', undefined, other)).status).toBe(404);
    expect((await request(`/admin/leads/${created.id}`, 'DELETE', undefined, admin)).status).toBe(204);
    expect(leads.leads.has(created.id)).toBe(false);
  });

  it('returns 404 when deleting a nonexistent lead', async () => {
    expect((await request('/admin/leads/00000000-0000-4000-8000-000000000099', 'DELETE', undefined, owner)).status).toBe(404);
  });
});
