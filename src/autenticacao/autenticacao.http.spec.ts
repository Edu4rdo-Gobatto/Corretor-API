import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { FindOneOptions, FindOptionsWhere } from 'typeorm';
import { Corretor, CargoCorretor } from '../corretores/corretor.entity';
import { SenhasService } from '../corretores/senhas.service';
import { AutenticacaoModule } from './autenticacao.module';
import { SessaoLogin } from './sessao-login.entity';

describe('HTTP da autenticação em português', () => {
  let app: INestApplication;
  let origem: string;
  let admin: Corretor;
  let corretor: Corretor;
  let acesso: string;
  let cookie: string;
  const registros = new Map<string, Corretor>();
  const sessoes = new Map<string, SessaoLogin>();
  const segredo = 'segredo-de-testes-com-no-minimo-32-caracteres';
  const senha = 'senha-segura-de-teste';
  const jwt = new JwtService({ secret: segredo, signOptions: { expiresIn: '15m', algorithm: 'HS256', issuer: 'corretor-api', audience: 'corretor-web' } });
  const repositorio = {
    findOneBy: (filtros: FindOptionsWhere<Corretor>) => Promise.resolve([...registros.values()].find(c => Object.entries(filtros).every(([campo, valor]) => c[campo as keyof Corretor] === valor)) ?? null),
    findOne: (opcoes: FindOneOptions<Corretor>) => repositorio.findOneBy(opcoes.where as FindOptionsWhere<Corretor>),
    findAndCount: () => Promise.resolve([[...registros.values()], registros.size]),
    save: (registro: Corretor) => { registros.set(registro.id, registro); return Promise.resolve(registro); },
    manager: { transaction: async (operacao: (gerente: { query: () => Promise<void>; getRepository: () => unknown }) => Promise<unknown>) => operacao({ query: () => Promise.resolve(), getRepository: () => repositorio }) },
  };
  const repositorio_sessoes = {
    create: (dados: Partial<SessaoLogin>) => Object.assign(new SessaoLogin(), dados),
    save: (sessao: SessaoLogin) => { sessoes.set(sessao.token_hash, sessao); return Promise.resolve(sessao); },
    delete: (filtro: { token_hash: string }) => { sessoes.delete(filtro.token_hash); return Promise.resolve({}); },
    createQueryBuilder: () => {
      let token_hash = '';
      const consulta = { delete: () => consulta,
        where: (sql: string, parametros: { hash?: string; corretor_id?: string }) => { token_hash = parametros.hash ?? ''; if (sql.includes('corretor_id')) for (const [chave, sessao] of sessoes) if (sessao.corretor_id === parametros.corretor_id) sessoes.delete(chave); return consulta; },
        returning: () => consulta,
        execute: () => { const sessao = sessoes.get(token_hash); sessoes.delete(token_hash); return Promise.resolve({ raw: sessao ? [sessao] : [], affected: sessao ? 1 : 0 }); },
      };
      return consulta;
    },
  };

  const requisitar = (caminho: string, opcoes?: RequestInit) => fetch(`${origem}${caminho}`, opcoes);
  const json = (dados: unknown, cabecalhos: Record<string, string> = {}): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://imobiliaria.example', ...cabecalhos }, body: JSON.stringify(dados) });

  beforeAll(async () => {
    const senha_hash = await new SenhasService().gerarHash(senha);
    const base = { nome: 'Maria Silva', cpf: '52998224725', whatsapp: '66999999999', senha_hash, creci: null, url_foto: null, ativo: true, criado_em: new Date(), alterado_em: new Date(), criado_por: null, alterado_por: null };
    admin = Object.assign(new Corretor(), base, { id: randomUUID(), email: 'admin@example.com', cargo: CargoCorretor.ADMIN });
    corretor = Object.assign(new Corretor(), base, { id: randomUUID(), email: 'corretor@example.com', cargo: CargoCorretor.CORRETOR });
    registros.set(admin.id, admin); registros.set(corretor.id, corretor);
    const modulo = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, skipProcessEnv: true, load: [() => ({ JWT_SECRET: segredo, JWT_EXPIRES_IN: '15m', ALLOWED_ORIGINS: 'https://imobiliaria.example' })] }), AutenticacaoModule] })
      .overrideProvider(getRepositoryToken(Corretor)).useValue(repositorio)
      .overrideProvider(getRepositoryToken(SessaoLogin)).useValue(repositorio_sessoes).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, validationError: { target: false, value: false } }));
    await app.listen(0, '127.0.0.1');
    const servidor = app.getHttpServer() as Server;
    origem = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    acesso = await jwt.signAsync({ sub: admin.id, cargo: CargoCorretor.ADMIN });
  });
  afterAll(async () => { await app?.close(); });

  it('entra com campos portugueses, cookie seguro e resposta sem segredo', async () => {
    const resposta = await requisitar('/autenticacao/entrar', json({ email: ' ADMIN@EXAMPLE.COM ', senha }));
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('cache-control')).toBe('no-store');
    const cabecalho = resposta.headers.get('set-cookie') ?? '';
    expect(cabecalho).toContain('HttpOnly'); expect(cabecalho).toContain('Secure'); expect(cabecalho).toContain('SameSite=Strict'); expect(cabecalho).toContain('Max-Age=2592000');
    cookie = cabecalho.split(';')[0];
    const dados: unknown = await resposta.json();
    expect(dados).toMatchObject({ tipo_token: 'Bearer', corretor: { id: admin.id, cargo: 'ADMIN' } });
    expect(dados).toHaveProperty('token_acesso');
    expect(JSON.stringify(dados)).not.toMatch(/senha|token_renovacao|token_hash/);
  });
  it('renova uma só vez e o token anterior perde validade', async () => {
    const primeira = await requisitar('/autenticacao/renovar', json({}, { Cookie: cookie }));
    expect(primeira.status).toBe(200);
    const antiga = cookie;
    cookie = (primeira.headers.get('set-cookie') ?? '').split(';')[0];
    expect(cookie).not.toBe(antiga);
    expect((await requisitar('/autenticacao/renovar', json({}, { Cookie: antiga }))).status).toBe(401);
  });
  it('retorna perfil atual somente com autenticação', async () => {
    expect((await requisitar('/autenticacao/eu')).status).toBe(401);
    const resposta = await requisitar('/autenticacao/eu', { headers: { Authorization: `Bearer ${acesso}` } });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ id: admin.id, nome: 'Maria Silva' });
  });
  it('cargo ADMIN adulterado no payload não concede acesso à gestão', async () => {
    const adulterado = await jwt.signAsync({ sub: corretor.id, cargo: CargoCorretor.ADMIN });
    expect((await requisitar('/admin/corretores', { headers: { Authorization: `Bearer ${adulterado}` } })).status).toBe(403);
    expect((await requisitar('/admin/corretores', { headers: { Authorization: `Bearer ${acesso}` } })).status).toBe(200);
  });
  it('desativação e rebaixamento têm efeito imediato no token já emitido', async () => {
    admin.cargo = CargoCorretor.CORRETOR;
    expect((await requisitar('/admin/corretores', { headers: { Authorization: `Bearer ${acesso}` } })).status).toBe(403);
    admin.ativo = false;
    expect((await requisitar('/autenticacao/eu', { headers: { Authorization: `Bearer ${acesso}` } })).status).toBe(401);
    expect((await requisitar('/autenticacao/renovar', json({}, { Cookie: cookie }))).status).toBe(401);
    admin.ativo = true; admin.cargo = CargoCorretor.ADMIN;
  });
  it('recusa senha errada e DTO inglês', async () => {
    expect((await requisitar('/autenticacao/entrar', json({ email: admin.email, senha: 'incorreta' }))).status).toBe(401);
    expect((await requisitar('/autenticacao/entrar', json({ email: admin.email, password: senha }))).status).toBe(400);
  });
  it('recusa origem externa em login, renovação e saída', async () => {
    for (const caminho of ['entrar', 'renovar', 'sair']) {
      expect((await requisitar(`/autenticacao/${caminho}`, json({ email: admin.email, senha }, { Origin: 'https://atacante.example' }))).status).toBe(403);
    }
  });
  it('recusa campos de privilégio no perfil próprio', async () => {
    const resposta = await requisitar('/autenticacao/eu', { ...json({ cargo: 'ADMIN', ativo: false, email: 'outra@example.com' }, { Authorization: `Bearer ${acesso}` }), method: 'PATCH' });
    expect(resposta.status).toBe(400);
  });
  it('revoga todas as sessões ao trocar a senha', async () => {
    const login = await requisitar('/autenticacao/entrar', json({ email: corretor.email, senha }));
    const sessaoAnterior = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const tokenCorretor = await jwt.signAsync({ sub: corretor.id, cargo: CargoCorretor.CORRETOR });
    const resposta = await requisitar('/autenticacao/eu/senha', { ...json({ senha_atual: senha, nova_senha: 'nova-senha-segura' }), headers: { Authorization: `Bearer ${tokenCorretor}`, Origin: 'https://imobiliaria.example', 'Content-Type': 'application/json' }, method: 'PATCH' });
    expect(resposta.status).toBe(200);
    expect((await requisitar('/autenticacao/renovar', json({}, { Cookie: sessaoAnterior }))).status).toBe(401);
  });
  it('saída revoga o cookie e remove a sessão', async () => {
    const login = await requisitar('/autenticacao/entrar', json({ email: admin.email, senha }));
    const atual = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const resposta = await requisitar('/autenticacao/sair', json({}, { Cookie: atual }));
    expect(resposta.status).toBe(204);
    expect(resposta.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');
    expect((await requisitar('/autenticacao/renovar', json({}, { Cookie: atual }))).status).toBe(401);
  });
  it('limita tentativas por conta independentemente do formato do e-mail', async () => {
    const estados: number[] = [];
    for (let indice = 0; indice < 11; indice += 1) estados.push((await requisitar('/autenticacao/entrar', json({ email: indice % 2 ? ' ABUSO@EXAMPLE.COM ' : 'abuso@example.com', senha: 'incorreta' }))).status);
    expect(estados.slice(0, 10)).toEqual(Array<number>(10).fill(401));
    expect(estados[10]).toBe(429);
  });
});
