import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Agent, AgentRole } from '../agents/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { Property } from '../properties/property.entity';
import { AgentRepositoryFixture } from '../testing/agent-repository.fixture';
import { MediaRepositoryFixture } from '../testing/media-repository.fixture';
import { PropertyRepositoryFixture } from '../testing/property-repository.fixture';
import { toPropertyResponse } from '../properties/dto/property-response.dto';
import { MediaModule } from './media.module';
import { MAX_IMAGE_SIZE } from './media.service';
import { MediaType, PropertyMedia } from './property-media.entity';

describe('media HTTP contract (database and R2 boundaries replaced)', () => {
  let application: INestApplication;
  let baseUrl: string;
  const agents = new AgentRepositoryFixture();
  const properties = new PropertyRepositoryFixture(agents);
  const media = new MediaRepositoryFixture();
  const storage = { send: jest.fn<Promise<unknown>, [object]>(() => Promise.resolve({})) };
  const secret = 'media-test-secret-with-more-than-32-characters';
  const jwt = new JwtService({ secret, signOptions: { issuer: 'corretor-api', audience: 'corretor-web', expiresIn: '7d' } });
  let owner: Agent;
  let other: Agent;
  let admin: Agent;
  let property: Property;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true,
        load: [() => ({ JWT_SECRET: secret, JWT_EXPIRES_IN: '7d', R2_PUBLIC_URL: 'https://media.example.test' })] }),
      AuthModule, MediaModule,
    ] })
      .overrideProvider(getRepositoryToken(Agent)).useValue(agents)
      .overrideProvider(getRepositoryToken(Property)).useValue(properties)
      .overrideProvider(getRepositoryToken(PropertyMedia)).useValue(media)
      .overrideProvider('R2_S3_CLIENT').useValue(storage)
      .compile();
    application = module.createNestApplication();
    application.useLogger(false);
    application.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await application.listen(0, '127.0.0.1');
    baseUrl = await application.getUrl();
  });

  beforeEach(async () => {
    agents.agents.clear(); properties.properties.clear(); media.media.clear(); media.failSave = false; storage.send.mockClear();
    owner = await agents.save(agents.create({ name: 'Owner', email: 'owner@example.com', whatsappNumber: '5565999999999' }));
    other = await agents.save(agents.create({ name: 'Other', email: 'other@example.com', whatsappNumber: '5565988888888' }));
    admin = await agents.save(agents.create({ name: 'Admin', email: 'admin@example.com', role: AgentRole.ADMIN }));
    property = await properties.save(properties.create({
      agentId: owner.id, title: 'Galpão', slug: 'galpao-test', agent: owner,
    }));
  });

  afterAll(async () => { await application?.close(); });

  function tokenFor(account: Agent): string { return jwt.sign({ sub: account.id, role: account.role }); }

  function request(path: string, method = 'GET', body?: BodyInit, account?: Agent, json = true): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { method, headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(account ? { Authorization: `Bearer ${tokenFor(account)}` } : {}),
    }, body });
  }

  async function upload(account = owner, names = ['one.jpg', 'two.jpg']): Promise<PropertyMedia[]> {
    const form = new FormData();
    names.forEach((name) => form.append('files', new Blob([name], { type: 'image/jpeg' }), name));
    const response = await request(`/properties/${property.id}/media`, 'POST', form, account, false);
    expect(response.status).toBe(201);
    return await response.json() as PropertyMedia[];
  }

  it('requires authentication and restricts agents to their own property', async () => {
    const form = new FormData(); form.append('files', new Blob(['x'], { type: 'image/jpeg' }), 'one.jpg');
    expect((await request(`/properties/${property.id}/media`, 'POST', form, undefined, false)).status).toBe(401);
    expect((await request(`/properties/${property.id}/media`, 'POST', form, other, false)).status).toBe(404);
    expect((await request('/properties/not-a-uuid/media', 'POST', form, owner, false)).status).toBe(400);
  });

  it('uploads images to R2, persists ordered metadata, and makes the first item the cover', async () => {
    const result = await upload();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: MediaType.IMAGE, orderIndex: 0, isCover: true });
    expect(result[0].url).toMatch(/^https:\/\/media\.example\.test\/properties\//);
    expect(result[1]).toMatchObject({ type: MediaType.IMAGE, orderIndex: 1, isCover: false });
    expect(storage.send).toHaveBeenCalledTimes(2);
    expect(storage.send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    property.media = result;
    expect(toPropertyResponse(property).media).toEqual([
      expect.objectContaining({ id: result[0].id, orderIndex: 0 }),
      expect.objectContaining({ id: result[1].id, orderIndex: 1 }),
    ]);
  });

  it('rejects unsupported and oversized files before sending them to R2', async () => {
    const unsupported = new FormData(); unsupported.append('files', new Blob(['x'], { type: 'application/pdf' }), 'file.pdf');
    expect((await request(`/properties/${property.id}/media`, 'POST', unsupported, owner, false)).status).toBe(400);
    const oversized = new FormData(); oversized.append('files', new Blob([Buffer.alloc(MAX_IMAGE_SIZE + 1)], { type: 'image/jpeg' }), 'large.jpg');
    expect((await request(`/properties/${property.id}/media`, 'POST', oversized, owner, false)).status).toBe(400);
    expect(storage.send).not.toHaveBeenCalled();
  });

  it('cleans already-uploaded objects when database persistence fails', async () => {
    media.failSave = true;
    const form = new FormData(); form.append('files', new Blob(['x'], { type: 'image/jpeg' }), 'one.jpg');
    const response = await request(`/properties/${property.id}/media`, 'POST', form, owner, false);
    expect(response.status).toBe(500);
    expect(storage.send.mock.calls.some(([command]) => command instanceof PutObjectCommand)).toBe(true);
    expect(storage.send.mock.calls.some(([command]) => command instanceof DeleteObjectCommand)).toBe(true);
    expect(media.media.size).toBe(0);
  });

  it('accepts supported embeds and rejects other hosts', async () => {
    const accepted = await request(`/properties/${property.id}/media/embed`, 'POST', JSON.stringify({ url: 'https://youtu.be/example' }), owner);
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toMatchObject({ type: MediaType.VIDEO_EMBED, isCover: true, storageKey: null });
    const rejected = await request(`/properties/${property.id}/media/embed`, 'POST', JSON.stringify({ url: 'https://evil.example/video' }), owner);
    expect(rejected.status).toBe(400);
  });

  it('reorders only complete unique media sets and changes the single cover', async () => {
    const [first, second] = await upload();
    const invalid = await request(`/properties/${property.id}/media/reorder`, 'PATCH', JSON.stringify({ mediaIds: [first.id] }), owner);
    expect(invalid.status).toBe(400);
    const reordered = await request(`/properties/${property.id}/media/reorder`, 'PATCH', JSON.stringify({ mediaIds: [second.id, first.id] }), owner);
    expect(reordered.status).toBe(200);
    expect((await reordered.json() as PropertyMedia[]).map((item) => item.id)).toEqual([second.id, first.id]);
    const covered = await request(`/properties/${property.id}/media/${second.id}/cover`, 'PATCH', undefined, owner, false);
    expect(covered.status).toBe(200);
    expect([...media.media.values()].filter((item) => item.isCover)).toEqual([expect.objectContaining({ id: second.id })]);
  });

  it('lets ADMIN manage another owner and promotes a replacement cover after deletion', async () => {
    const [first, second] = await upload(owner);
    expect((await request(`/properties/${property.id}/media/${first.id}`, 'DELETE', undefined, other, false)).status).toBe(404);
    expect((await request(`/properties/${property.id}/media/${first.id}`, 'DELETE', undefined, admin, false)).status).toBe(204);
    expect(media.media.has(first.id)).toBe(false);
    expect(media.media.get(second.id)?.isCover).toBe(true);
    expect(storage.send.mock.calls.some(([command]) => command instanceof DeleteObjectCommand)).toBe(true);
  });
});
