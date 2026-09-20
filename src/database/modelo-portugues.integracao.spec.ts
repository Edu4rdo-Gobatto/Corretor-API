import 'reflect-metadata';
import { createCipheriv, createHash } from 'node:crypto';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, QueryRunner } from 'typeorm';
import { createPostgresOptions } from '../config/database.config';
import { entidades, migracoesLegadas } from './registros';
import { ModeloPortugues1789516800000 } from './migrations/1789516800000-modelo-portugues';
import { IdsInteirosPessoas1789603200000 } from './migrations/1789603200000-ids-inteiros-pessoas';
import { Corretor } from '../corretores/corretor.entity';
import { Pessoa } from '../pessoas/pessoa.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { Comissao } from '../comissoes/comissao.entity';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { SenhasService } from '../corretores/senhas.service';

// Neon: HOMOLOGACAO_DATABASE_URL (database homologacao_pt, conexão direta). Local: TESTE_LOCAL_DATABASE_URL em localhost, sem TLS.
const conexao = process.env.HOMOLOGACAO_DATABASE_URL ?? process.env.TESTE_LOCAL_DATABASE_URL;
const executar = conexao ? describe : describe.skip;

executar('modelo português com ids inteiros no PostgreSQL 16 isolado (transação revertida)', () => {
  let banco: DataSource;
  let executor: QueryRunner;
  let pasta = '';
  let aplicacao: INestApplication | undefined;
  let origem = '';
  const ambienteApiAnterior = new Map<string, string | undefined>();
  const ambienteAnterior = { complemento: process.env.MIGRACAO_COMPLEMENTOS_ARQUIVO, chave: process.env.LEADS_ENCRYPTION_KEY };
  const id = (numero: number) => `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
  const cifrar = (valor: string, dominio = '') => {
    const iv = Buffer.alloc(12, 7);
    const cifra = createCipheriv('aes-256-gcm', createHash('sha256').update(dominio).update('chave-sintetica-homologacao').digest(), iv);
    const conteudo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
    return `${dominio ? 'rental' : 'enc'}:v1:${iv.toString('base64url')}.${cifra.getAuthTag().toString('base64url')}.${conteudo.toString('base64url')}`;
  };

  beforeAll(async () => {
    const url = new URL(conexao!);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!local && (url.pathname !== '/homologacao_pt' || !url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler'))) throw new Error('Use somente database homologacao_pt isolada, com conexão direta Neon, ou um PostgreSQL local.');
    banco = new DataSource({ ...createPostgresOptions(conexao!), ...(local ? { ssl: false } : {}), entities: entidades });
    await banco.initialize();
    executor = banco.createQueryRunner();
    await executor.connect();
    if (!local) {
      const [atual] = await executor.query('SELECT current_database() AS nome') as Array<{ nome: string }>;
      expect(atual.nome).toBe('homologacao_pt');
    }
    await executor.startTransaction();
    for (const Migracao of migracoesLegadas) await new Migracao().up(executor);
    await executor.query(`INSERT INTO agents (id,name,email,password_hash,whatsapp_number,role) VALUES ($1,'Administrador Teste','admin@example.test','hash-legado-preservado','5566999999999','ADMIN')`, [id(1)]);
    await executor.query(`INSERT INTO properties (id,title,slug,type,purpose,price,usable_area,total_area,address_street,address_number,address_city,address_state,neighborhood,description,features,agent_id)
      VALUES ($1,'Sala de Teste','sala-teste','SALA','VENDA',1000,50,70,'Rua Teste','10','Sinop','MT','Centro','Sala para homologação','{"Vagas":"4"}',$2)`, [id(2),id(1)]);
    await executor.query(`INSERT INTO property_media (id,property_id,type,url,storage_key,is_cover) VALUES ($1,$2,'IMAGE','https://example.test/foto.webp','teste.webp',true)`, [id(3),id(2)]);
    await executor.query(`INSERT INTO leads (id,property_id,agent_id,lead_name,lead_phone,lead_email,consent_given,consent_timestamp,consent_ip)
      VALUES ($1,$2,$3,$4,$5,$6,true,now(),'127.0.0.1')`, [id(4),id(2),id(1),cifrar('Cliente Sintético'),cifrar('66999999999'),cifrar('cliente@example.test')]);
    for (const [numero,papel,documento] of [[5,'OWNER','52998224725'],[6,'TENANT','11222333000181']] as const) {
      await executor.query(`INSERT INTO rental_parties (id,kind,person_type,name,private_data) VALUES ($1,$2,$3,$4,$5)`,
        [id(numero),papel,papel === 'OWNER' ? 'PF' : 'PJ',papel === 'OWNER' ? 'Proprietária Sintética' : 'Empresa Locatária',cifrar(JSON.stringify({ taxId: documento, email: 'pessoa@example.test', phone: '66999999999', address: 'Rua Teste', birthDate: '', bankName: 'Banco Teste', bankAgency: '001', bankAccount: '002', pixKey: 'pessoa@example.test', notes: 'Observação privada' }), 'rental-administration:v1:')]);
    }
    await executor.query(`INSERT INTO leases (id,reference,property_id,owner_id,tenant_id,start_date,end_date,rent_amount,due_day,status,notes)
      VALUES ($1,'LOC-2030-001',$2,$3,$4,'2030-01-01','2030-12-31',1000,31,'ACTIVE',$5)`, [id(7),id(2),id(5),id(6),cifrar(JSON.stringify('Observações contrato'), 'rental-administration:v1:')]);
    await executor.query(`INSERT INTO acquisition_commissions (id,lease_id,total_amount,installment_count,notes) VALUES ($1,$2,100,1,'Comissão histórica')`, [id(8),id(7)]);
    await executor.query(`INSERT INTO commission_installments (id,commission_id,installment_number,due_date,amount,status,paid_at,payment_note) VALUES ($1,$2,1,'2030-01-31',100,'PAID',now(),'Comprovante teste')`, [id(9),id(8)]);
    await executor.query(`INSERT INTO rental_documents (id,party_id,file_name,content_type,size,storage_key,bucket) VALUES ($1,$2,'historico.pdf','application/pdf',100,'hist.pdf','privado-teste')`, [id(10),id(5)]);
    // O primeiro ensaio comprova que não há preenchimento silencioso de campos obrigatórios.
    delete process.env.MIGRACAO_COMPLEMENTOS_ARQUIVO;
    await expect(new ModeloPortugues1789516800000().up(executor)).rejects.toThrow('CPF');
    pasta = await mkdtemp(join(tmpdir(), 'corretor-homologacao-'));
    const arquivo = join(pasta, 'complementos.json');
    await writeFile(arquivo, JSON.stringify({ corretores: { [id(1)]: { cpf: '52998224725' } }, responsavel_migracao: id(1), contratos: { [id(7)]: {
      corretor_id: id(1), taxa_administracao: '8.00', garantia_locaticia: 'Caução', indice_reajuste: 'IPCA', cobranca_iptu_condominio: 'Pagamento direto',
    } }, clientes_manuais: { [id(12)]: { nome: 'Cliente Sem Lead', telefone: '66999999999', corretor_id: id(1), imovel_id: id(2) } }, comissoes: { [id(8)]: { cliente_id: id(12) } } }));
    process.env.MIGRACAO_COMPLEMENTOS_ARQUIVO = arquivo;
    process.env.LEADS_ENCRYPTION_KEY = 'chave-sintetica-homologacao';
    await new ModeloPortugues1789516800000().up(executor);
    await new IdsInteirosPessoas1789603200000().up(executor);
    const ambienteApi: Record<string, string> = {
      DATABASE_URL: local ? 'postgresql://validacao:apenas@validacao.neon.tech/validacao?sslmode=require' : conexao!, NODE_ENV: 'test', JWT_SECRET: 'segredo-jwt-sintetico-apenas-homologacao', JWT_EXPIRES_IN: '15m',
      R2_ENDPOINT: 'https://teste.r2.cloudflarestorage.com', R2_ACCESS_KEY_ID: 'sintetico', R2_SECRET_ACCESS_KEY: 'sintetico',
      R2_PUBLIC_URL: 'https://example.test', ALLOWED_ORIGINS: 'https://frontend.example.test',
      GOOGLE_DRIVE_CLIENT_EMAIL: '', GOOGLE_DRIVE_PRIVATE_KEY: '', GOOGLE_DRIVE_ROOT_FOLDER_ID: '', GOOGLE_DRIVE_SHARED_DRIVE_ID: '',
    };
    for (const [chave, valor] of Object.entries(ambienteApi)) { ambienteApiAnterior.set(chave, process.env[chave]); process.env[chave] = valor; }
    const conexaoTransacional = new Proxy(banco, { get(alvo, propriedade, receptor): unknown {
      if (propriedade === 'manager') return executor.manager;
      if (propriedade === 'getRepository') return executor.manager.getRepository.bind(executor.manager);
      if (propriedade === 'transaction') return executor.manager.transaction.bind(executor.manager);
      if (propriedade === 'query') return executor.query.bind(executor);
      if (propriedade === 'destroy') return () => Promise.resolve();
      return Reflect.get(alvo, propriedade, receptor) as unknown;
    } });
    const { AppModule } = await import('../app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DataSource).useValue(conexaoTransacional).compile();
    aplicacao = modulo.createNestApplication({ logger: false });
    aplicacao.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await aplicacao.listen(0, '127.0.0.1');
    const servidor = aplicacao.getHttpServer() as Server;
    origem = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  }, 90000);

  afterAll(async () => {
    if (aplicacao) await aplicacao.close();
    if (executor?.isTransactionActive) await executor.rollbackTransaction();
    if (executor && !executor.isReleased) await executor.release();
    if (banco?.isInitialized) await banco.destroy();
    if (pasta) { await unlink(join(pasta, 'complementos.json')); await rmdir(pasta); }
    for (const [campo, valor] of [['MIGRACAO_COMPLEMENTOS_ARQUIVO',ambienteAnterior.complemento],['LEADS_ENCRYPTION_KEY',ambienteAnterior.chave]]) {
      if (valor === undefined) delete process.env[campo!]; else process.env[campo!] = valor;
    }
    for (const [campo, valor] of ambienteApiAnterior) { if (valor === undefined) delete process.env[campo]; else process.env[campo] = valor; }
  }, 20000);

  async function recusar(sql: string, parametros: unknown[], codigo: string): Promise<void> {
    await executor.query('SAVEPOINT verificacao');
    try { await expect(executor.query(sql,parametros)).rejects.toMatchObject({ code: codigo }); }
    finally { await executor.query('ROLLBACK TO SAVEPOINT verificacao'); await executor.query('RELEASE SAVEPOINT verificacao'); }
  }

  it('converte ids para inteiros, funde pessoas, traduz valores/status e reescreve slugs', async () => {
    for (const entidade of entidades) await executor.manager.getRepository(entidade).find({ take: 1 });
    const corretor = await executor.manager.getRepository(Corretor).createQueryBuilder('corretor').addSelect('corretor.senha_hash').getOneOrFail();
    expect(corretor).toMatchObject({ id: 1, cargo: 'ADMIN', cpf: '52998224725', senha_hash: 'hash-legado-preservado' });
    const lead = await executor.manager.findOneByOrFail(Pessoa, { nome: 'Cliente Sintético' });
    expect(lead).toMatchObject({ telefone: '66999999999', email: 'cliente@example.test', origem: 'SITE', status_contato: 'PENDENTE', consentimento: true, corretor_id: 1 });
    expect(await executor.manager.findOneByOrFail(Pessoa, { nome: 'Proprietária Sintética' })).toMatchObject({ tipo_pessoa: 'PF', cpf_cnpj: '52998224725', banco_nome: 'Banco Teste', observacoes: 'Observação privada', origem: 'MANUAL', status_contato: 'FINALIZADO', corretor_id: 1 });
    const imovel = await executor.manager.findOneByOrFail(Imovel, { titulo: 'Sala de Teste' });
    expect(imovel).toMatchObject({ slug: `sala-teste-${imovel.id}`, valor_venda: '1000.00', valor_locacao: null, status: 'DISPONIVEL', destaque: false, exclusividade: false, proprietario_id: null });
    const contrato = await executor.manager.findOneOrFail(Contrato, { where: { numero_contrato: 'LOC-2030-001' }, relations: { locador: true, locatario: true } });
    expect(contrato).toMatchObject({ status: 'ATIVO', observacoes: 'Observações contrato', taxa_administracao: '8.00', imovel_id: imovel.id, corretor_id: 1 });
    expect([contrato.locador.nome, contrato.locatario.nome]).toEqual(['Proprietária Sintética', 'Empresa Locatária']);
    const comissao = await executor.manager.findOneOrFail(Comissao, { where: { contrato_id: contrato.id }, relations: { pessoa: true, parcelas: true } });
    expect(comissao.pessoa.nome).toBe('Cliente Sem Lead');
    expect(comissao.parcelas.map(parcela => parcela.status)).toEqual(['PAGO']);
    const [tag] = await executor.query('SELECT valor FROM imoveis_caracteristicas') as Array<{ valor: string }>;
    expect(tag.valor).toBe('4');
    const [pasta] = await executor.query("SELECT count(*)::int AS total FROM pastas_drive WHERE chave LIKE 'contrato:%' AND chave !~ '^contrato:[0-9]+$'") as Array<{ total: number }>;
    expect(pasta.total).toBe(0);
  });

  it('protege unicidade de contrato ativo, capa, parcelas e relações históricas', async () => {
    await recusar(`INSERT INTO contrato (numero_contrato,imovel_id,locador_id,locatario_id,corretor_id,data_inicio,data_fim,valor_aluguel,dia_vencimento,taxa_administracao,garantia_locaticia,indice_reajuste,cobranca_iptu_condominio)
      SELECT 'LOC-DUPLICADO',imovel_id,locador_id,locatario_id,corretor_id,data_inicio,data_fim,valor_aluguel,dia_vencimento,taxa_administracao,garantia_locaticia,indice_reajuste,cobranca_iptu_condominio FROM contrato LIMIT 1`, [], '23505');
    await recusar(`INSERT INTO imoveis_midias (imovel_id,tipo,url,capa,criado_por) SELECT id,'IMAGEM','https://example.test/outra.webp',true,1 FROM imoveis LIMIT 1`, [], '23505');
    await recusar('DELETE FROM pessoas WHERE id = (SELECT locador_id FROM contrato LIMIT 1)', [], '23503');
    await recusar('UPDATE imoveis SET area_total = 1', [], '23514');
    await recusar('UPDATE parcelas_comissao SET valor = 0', [], '23514');
    await recusar('UPDATE parcelas_comissao SET pago_em = NULL', [], '23514');
    await recusar("UPDATE pessoas SET tipo_pessoa = 'PJ' WHERE cpf_cnpj = '52998224725'", [], '23514');
  });

  it('retém os modelos antigos fora do schema operacional', async () => {
    const [documentos] = await executor.query('SELECT count(*)::int AS total FROM legado_20260913.rental_documents') as Array<{ total: number }>;
    expect(documentos.total).toBe(1);
    const [clientes] = await executor.query('SELECT count(*)::int AS total FROM legado_20260916.clientes') as Array<{ total: number }>;
    expect(clientes.total).toBe(2);
    for (const tabela of ['clientes', 'partes_locacao', 'rental_documents']) {
      const [antigo] = await executor.query(`SELECT to_regclass('public.${tabela}') AS tabela`) as Array<{ tabela: string | null }>;
      expect(antigo.tabela).toBeNull();
    }
    const colunas = await executor.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='pessoas'") as Array<{ column_name: string }>;
    expect(colunas.map(coluna => coluna.column_name)).toEqual(expect.arrayContaining(['status_contato', 'cpf_cnpj', 'chave_pix']));
    expect(colunas.map(coluna => coluna.column_name)).not.toContain('papel');
  });

  it('integra login, catálogo, pessoas, ficha do imóvel e comissões HTTP com repositórios reais', async () => {
    expect((await fetch(`${origem}/saude`)).status).toBe(200);
    const senha = 'Senha-Sintetica-123!';
    await executor.manager.update(Corretor, { id: 1 }, { senha_hash: await new SenhasService().gerarHash(senha) });
    const entrar = await fetch(`${origem}/autenticacao/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', senha }) });
    expect(entrar.status).toBe(200);
    const sessao = await entrar.json() as { token_acesso: string; corretor: { id: number } };
    expect(sessao.corretor.id).toBe(1);
    expect(entrar.headers.get('set-cookie')).toEqual(expect.stringContaining('HttpOnly'));
    expect((await fetch(`${origem}/admin/pessoas`)).status).toBe(401);
    const imovel = await executor.manager.findOneByOrFail(Imovel, { titulo: 'Sala de Teste' });
    const catalogo = await fetch(`${origem}/imoveis?ordenar=valor_asc&valor_min=500&bairro=cen`);
    expect(catalogo.status).toBe(200);
    const texto = await catalogo.text();
    expect(texto).toContain('Sala de Teste');
    expect(texto).not.toMatch(/cpf|proprietario|matricula/);
    expect(JSON.parse(texto)).toMatchObject({ total: 1, total_paginas: 1 });
    const renomeado = await fetch(`${origem}/imoveis/sala-renomeada-${imovel.id}`);
    expect(renomeado.status).toBe(200);
    expect(await renomeado.json()).toMatchObject({ id: imovel.id, slug: `sala-teste-${imovel.id}` });
    const cabecalhos = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.token_acesso}` };
    const criar = await fetch(`${origem}/admin/pessoas`, { method: 'POST', headers: cabecalhos, body: JSON.stringify({ nome: 'Pessoa Manual HTTP', telefone: '66999999999', cpf_cnpj: '529.982.247-25' }) });
    expect(criar.status).toBe(201);
    const pessoa = await criar.json() as { id: number; consentimento: boolean; status_contato: string; tipo_pessoa: string };
    expect(pessoa).toMatchObject({ consentimento: false, status_contato: 'RESPONDIDO', tipo_pessoa: 'PF' });
    expect(typeof pessoa.id).toBe('number');
    const finalizar = await fetch(`${origem}/admin/pessoas/${pessoa.id}`, { method: 'PATCH', headers: cabecalhos, body: JSON.stringify({ status_contato: 'FINALIZADO' }) });
    expect(finalizar.status).toBe(200);
    const contato = await fetch(`${origem}/pessoas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Visitante do Site', telefone: '66988887777', imovel_id: imovel.id, consentimento: true }) });
    expect(contato.status).toBe(201);
    const pendentes = await fetch(`${origem}/admin/pessoas?status_contato=PENDENTE`, { headers: cabecalhos });
    const buscaPorTelefone = await fetch(`${origem}/admin/pessoas?busca=(66) 98888`, { headers: cabecalhos });
    expect(await buscaPorTelefone.json()).toMatchObject({ total: 1, itens: [expect.objectContaining({ nome: 'Visitante do Site' })] });
    expect(await pendentes.json()).toMatchObject({ total: 2, itens: [expect.objectContaining({ nome: 'Visitante do Site', origem: 'SITE' }), expect.objectContaining({ nome: 'Cliente Sintético' })] });
    const ficha = await fetch(`${origem}/admin/imoveis/${imovel.id}`, { method: 'PATCH', headers: cabecalhos, body: JSON.stringify({ titulo: 'Sala Renomeada', proprietario_id: pessoa.id, valor_locacao: '1500.00', chaves: 'Com o zelador', exclusividade: true, exclusividade_ate: '2027-01-31' }) });
    expect(ficha.status).toBe(200);
    expect(await ficha.json()).toMatchObject({ slug: `sala-renomeada-${imovel.id}`, proprietario: { id: pessoa.id, nome: 'Pessoa Manual HTTP' }, valor_locacao: '1500.00', chaves: 'Com o zelador', exclusividade: true });
    const publico = await fetch(`${origem}/imoveis/sala-renomeada-${imovel.id}`);
    expect(publico.status).toBe(200);
    expect(await publico.text()).not.toMatch(/proprietario|chaves|exclusividade/);
    const comissao = await fetch(`${origem}/admin/comissoes`, { method: 'POST', headers: cabecalhos, body: JSON.stringify({ tipo_operacao: 'VENDA', imovel_id: imovel.id, pessoa_id: pessoa.id, valor_total: '100.00', quantidade_parcelas: 3, primeiro_vencimento: '2030-01-31' }) });
    expect(comissao.status).toBe(201);
    const receita = await comissao.json() as { parcelas: Array<{ id: number; valor: string; data_vencimento: string }> };
    expect(receita.parcelas.map(parcela => parcela.valor)).toEqual(['33.34', '33.33', '33.33']);
    expect(receita.parcelas.map(parcela => parcela.data_vencimento)).toEqual(['2030-01-31','2030-02-28','2030-03-31']);
    const baixa = await fetch(`${origem}/admin/comissoes/parcelas/${receita.parcelas[0].id}/pagamento`, { method: 'PATCH', headers: cabecalhos, body: JSON.stringify({ confirmar_pagamento: true, observacao_pagamento: 'Comprovante sintético' }) });
    expect(baixa.status).toBe(200);
    expect(await baixa.json()).toMatchObject({ status: 'PAGO' });
    const contratos = await fetch(`${origem}/admin/contratos`, { headers: cabecalhos });
    expect(await contratos.json()).toMatchObject({ total: 1, itens: [expect.objectContaining({ numero_contrato: 'LOC-2030-001', imovel_titulo: 'Sala Renomeada', locador_nome: 'Proprietária Sintética', locatario_nome: 'Empresa Locatária' })] });
    // Regressão: o id do imóvel vem do identity do banco; o slug gravado tem de apontar para o próprio imóvel criado.
    const [caracteristica] = await executor.query('SELECT id FROM caracteristicas ORDER BY id LIMIT 1') as Array<{ id: number }>;
    expect(caracteristica?.id).toEqual(expect.any(Number));
    const cadastrar = (titulo: string) => fetch(`${origem}/admin/imoveis`, { method: 'POST', headers: cabecalhos, body: JSON.stringify({
      titulo, tipo_id: imovel.tipo_id, finalidade_id: imovel.finalidade_id, area_util: '32.00', area_total: '32.00',
      logradouro: 'Rua das Araribás', numero: '727', bairro: 'Centro', cidade: 'Sinop', estado: 'MT', descricao: 'Imóvel criado pelo painel.',
      caracteristicas: [{ caracteristica_id: caracteristica.id, valor: '1' }],
    }) });
    const novo = await cadastrar('Kitnet de Regressão');
    expect(novo.status).toBe(201);
    const criado = await novo.json() as { id: number; slug: string; caracteristicas: unknown[] };
    expect(criado.slug).toBe(`kitnet-de-regressao-${criado.id}`);
    expect(criado.caracteristicas).toHaveLength(1);
    const fichaPublica = await fetch(`${origem}/imoveis/${criado.slug}`);
    expect(fichaPublica.status).toBe(200);
    expect(await fichaPublica.json()).toMatchObject({ id: criado.id, slug: criado.slug });
    // A sequência avança de um em um: nenhum id é reservado e descartado antes do INSERT.
    const seguinte = await cadastrar('Kitnet Vizinha');
    expect(seguinte.status).toBe(201);
    expect(await seguinte.json()).toMatchObject({ id: criado.id + 1, slug: `kitnet-vizinha-${criado.id + 1}` });
  }, 30000);
});
