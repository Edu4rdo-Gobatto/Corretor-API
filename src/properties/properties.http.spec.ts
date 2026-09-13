import { RefreshSession } from '../auth/refresh-session.entity';
import { SessionRepositoryFixture } from '../testing/session-repository.fixture';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent, AgentRole } from '../agents/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { AgentRepositoryFixture } from '../testing/agent-repository.fixture';
import { PropertyRepositoryFixture } from '../testing/property-repository.fixture';
import { Property, PropertyStatus } from './property.entity';
import { PropertiesModule } from './properties.module';

describe('property HTTP contract (database boundary replaced)', () => {
  let application: INestApplication;
  let baseUrl: string;
  const agents = new AgentRepositoryFixture();
  const properties = new PropertyRepositoryFixture(agents);
  const secret = 'properties-test-secret-with-more-than-32-characters';
  const jwt = new JwtService({ secret, signOptions: { issuer: 'corretor-api', audience: 'corretor-web', expiresIn: '7d' } });
  let owner: Agent;
  let other: Agent;
  let admin: Agent;
  const propertyInput = {
    title: 'Galpão em Cuiabá', type: 'GALPAO', purpose: 'LOCACAO', price: 12000.50,
    usableArea: 500, totalArea: 600, addressStreet: 'Rua Exemplo', addressNumber: '10',
    addressCity: 'Cuiabá', addressState: 'MT', neighborhood: 'Centro', description: 'Galpão comercial com docas.',
    features: { docas: 2 },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true,
        load: [() => ({ JWT_SECRET: secret, JWT_EXPIRES_IN: '7d' })] }),
      AuthModule, PropertiesModule,
    ] })
      .overrideProvider(getRepositoryToken(RefreshSession)).useValue(new SessionRepositoryFixture()).overrideProvider(getRepositoryToken(Agent)).useValue(agents)
      .overrideProvider(getRepositoryToken(Property)).useValue(properties).compile();
    application = module.createNestApplication();
    application.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await application.listen(0, '127.0.0.1');
    baseUrl = await application.getUrl();
  });

  beforeEach(async () => {
    agents.agents.clear(); properties.properties.clear();
    owner = await agents.save(agents.create({ name: 'Owner', email: 'owner@example.com', whatsappNumber: '5565999999999', passwordHash: 'private-hash' }));
    other = await agents.save(agents.create({ name: 'Other', email: 'other@example.com', whatsappNumber: '5565988888888' }));
    admin = await agents.save(agents.create({ name: 'Admin', email: 'admin@example.com', role: AgentRole.ADMIN }));
  });

  afterAll(async () => { await application?.close(); });

  function request(path: string, method = 'GET', body?: unknown, account?: Agent): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { method, headers: {
      'Content-Type': 'application/json', ...(account ? { Authorization: `Bearer ${jwt.sign({ sub: account.id, role: account.role })}` } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async function create(account = owner, overrides = {}): Promise<Property> {
    const response = await request('/properties', 'POST', { ...propertyInput, ...overrides }, account);
    expect(response.status).toBe(201);
    return await response.json() as Property;
  }

  it('creates an owned property, generates a URL slug, and exposes safe public contact details', async () => {
    const created = await create();
    expect(created.slug).toMatch(/^galpao-em-cuiaba-/);
    expect(created.agentId).toBe(owner.id);
    expect(created.price).toBe(12000.50);
    const response = await request(`/properties/${created.slug}`);
    expect(response.status).toBe(200);
    const body = await response.json() as Property;
    expect(body.agent).toMatchObject({ name: 'Owner', whatsappNumber: '5565999999999' });
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('owner@example.com');
  });

  it('searches managed properties by partial title without changing public query inputs', async () => {
    await create(owner, { title: 'Sala Centro' });
    await create(owner, { title: 'Galpão Industrial' });
    const result = await request('/admin/properties?search=centro', 'GET', undefined, admin);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ total: 1, items: [{ title: 'Sala Centro' }] });
    expect((await request('/properties?search=centro')).status).toBe(400);
  });

  it('returns filtered and paginated available properties', async () => {
    await create();
    await create(owner, { title: 'Another warehouse', price: 15000 });
    await create(owner, { type: 'LOJA', price: 9000 });
    await create(owner, { purpose: 'VENDA' });
    await create(owner, { addressCity: 'Rondonópolis' });
    const response = await request('/properties?type=GALPAO&purpose=LOCACAO&city=cuiab%C3%A1&minPrice=10000&maxPrice=15000&page=2&limit=1');
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Property[]; total: number; page: number; limit: number; totalPages: number };
    expect(body).toMatchObject({ total: 2, page: 2, limit: 1, totalPages: 2 });
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe('GALPAO');
  });

  it('hides reserved/completed properties and properties of inactive agents from public views', async () => {
    const reserved = await create(owner, { status: 'RESERVADO' });
    await create(owner, { status: 'CONCLUIDO' });
    const hidden = await create(other);
    other.active = false;
    const response = await request('/properties');
    expect(await response.json()).toMatchObject({ items: [], total: 0 });
    expect((await request(`/properties/${reserved.slug}`)).status).toBe(404);
    expect((await request(`/properties/${hidden.slug}`)).status).toBe(404);
  });

  it('lists all own statuses in the panel while ADMIN sees all owners', async () => {
    await create(owner, { status: 'CONCLUIDO' }); await create(other);
    expect(await (await request('/admin/properties', 'GET', undefined, owner)).json()).toMatchObject({ total: 1 });
    expect(await (await request('/admin/properties', 'GET', undefined, admin)).json()).toMatchObject({ total: 2 });
    expect((await request('/admin/properties')).status).toBe(401);
  });

  it('lets the owner edit while keeping the slug stable, and delete their property', async () => {
    const created = await create();
    const updated = await request(`/properties/${created.id}`, 'PATCH', { title: 'Novo título', price: 20000, condoFee: null }, owner);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ title: 'Novo título', slug: created.slug, price: 20000 });
    expect((await request(`/properties/${created.id}`, 'DELETE', undefined, owner)).status).toBe(204);
    expect(properties.properties.size).toBe(0);
    expect((await request(`/properties/${created.slug}`)).status).toBe(404);
  });

  it('prevents cross-owner inspection, updates and deletion', async () => {
    const created = await create();
    expect((await request(`/admin/properties/${created.id}`, 'GET', undefined, other)).status).toBe(404);
    expect((await request(`/properties/${created.id}`, 'PATCH', { price: 1 }, other)).status).toBe(404);
    expect((await request(`/properties/${created.id}`, 'DELETE', undefined, other)).status).toBe(404);
    expect(properties.properties.get(created.id)?.price).toBe(12000.50);
  });

  it('allows ADMIN to assign and reassign owners, but rejects an AGENT doing so', async () => {
    expect((await request('/properties', 'POST', { ...propertyInput, agentId: other.id }, owner)).status).toBe(403);
    const created = await create(admin, { agentId: owner.id });
    expect((await request(`/properties/${created.id}`, 'PATCH', { agentId: other.id }, owner)).status).toBe(403);
    const response = await request(`/properties/${created.id}`, 'PATCH', { agentId: other.id }, admin);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ agentId: other.id });
  });

  it('requires authentication to create or mutate', async () => {
    const created = await create();
    expect((await request('/properties', 'POST', propertyInput)).status).toBe(401);
    expect((await request(`/properties/${created.id}`, 'PATCH', { price: 1 })).status).toBe(401);
    expect((await request(`/properties/${created.id}`, 'DELETE')).status).toBe(401);
  });

  it.each([
    { price: -1 }, { price: 1.123 }, { price: 10000000000 }, { type: 'CASA' },
    { addressState: 'INVALID' }, { usableArea: 700 }, { features: [] }, { title: ' ' },
    { slug: 'injected-slug' }, { agentId: null },
  ])('rejects invalid creation %j', async (invalid) => {
    expect((await request('/properties', 'POST', { ...propertyInput, ...invalid }, owner)).status).toBe(400);
    expect(properties.properties.size).toBe(0);
  });

  it('validates partial updates against existing area and preserves unrelated fields', async () => {
    const created = await create(owner, { status: 'RESERVADO' });
    expect((await request(`/properties/${created.id}`, 'PATCH', { totalArea: 100 }, owner)).status).toBe(400);
    expect((await request(`/properties/${created.id}`, 'PATCH', { price: null }, owner)).status).toBe(400);
    expect((await request(`/properties/${created.id}`, 'PATCH', { price: 2000 }, owner)).status).toBe(200);
    expect(properties.properties.get(created.id)?.status).toBe(PropertyStatus.RESERVADO);
    expect(properties.properties.get(created.id)?.features).toEqual({ docas: 2 });
  });

  it('rejects assigning an inactive owner and validates management identifiers', async () => {
    other.active = false;
    expect((await request('/properties', 'POST', { ...propertyInput, agentId: other.id }, admin)).status).toBe(404);
    expect((await request('/properties/not-a-uuid', 'PATCH', { price: 10 }, owner)).status).toBe(400);
  });

  it.each(['page=0', 'limit=101', 'minPrice=200&maxPrice=100', 'status=CONCLUIDO', 'minPrice=abc'])('rejects invalid public filters %s', async (query) => {
    expect((await request(`/properties?${query}`)).status).toBe(400);
  });
});
