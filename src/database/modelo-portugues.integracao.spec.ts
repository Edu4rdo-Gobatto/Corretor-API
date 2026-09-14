import 'reflect-metadata';
import { createCipheriv, createHash } from 'node:crypto';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, QueryRunner } from 'typeorm';
import { createPostgresOptions } from '../config/database.config';
import { entidades, migracoesLegadas } from './registros';
import { ModeloPortugues1789516800000 } from './migrations/1789516800000-modelo-portugues';
import { Corretor } from '../corretores/corretor.entity';
import { Cliente } from '../clientes/cliente.entity';
import { ParteLocacao } from '../locacoes/parte-locacao.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { SenhasService } from '../corretores/senhas.service';

const executar = process.env.HOMOLOGACAO_DATABASE_URL ? describe : describe.skip;

executar('modelo português no PostgreSQL 16 isolado (transação revertida)', () => {
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
    const conexao = process.env.HOMOLOGACAO_DATABASE_URL!;
    const url = new URL(conexao);
    if (url.pathname !== '/homologacao_pt' || !url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler')) throw new Error('Use somente database homologacao_pt isolada, com conexão direta Neon.');
    banco = new DataSource({ ...createPostgresOptions(conexao), entities: entidades });
    await banco.initialize();
    executor = banco.createQueryRunner();
    await executor.connect();
    const [atual] = await executor.query('SELECT current_database() AS nome') as Array<{ nome: string }>;
    expect(atual.nome).toBe('homologacao_pt');
    await executor.startTransaction();
    for (const Migracao of migracoesLegadas) await new Migracao().up(executor);
    await executor.query(`INSERT INTO agents (id,name,email,password_hash,whatsapp_number,role) VALUES ($1,'Administrador Teste','admin@example.test','hash-legado-preservado','5566999999999','ADMIN')`, [id(1)]);
    await executor.query(`INSERT INTO properties (id,title,slug,type,purpose,price,usable_area,total_area,address_street,address_number,address_city,address_state,neighborhood,description,features,agent_id)
      VALUES ($1,'Sala de Teste','sala-teste','SALA','VENDA',1000,50,70,'Rua Teste','10','Sinop','MT','Centro','Sala para homologação','{"Vagas":"4"}',$2)`, [id(2),id(1)]);
    await executor.query(`INSERT INTO property_media (id,property_id,type,url,storage_key,is_cover) VALUES ($1,$2,'IMAGE','https://example.test/foto.webp','teste.webp',true)`, [id(3),id(2)]);
    await executor.query(`INSERT INTO leads (id,property_id,agent_id,lead_name,lead_phone,lead_email,consent_given,consent_timestamp,consent_ip)
      VALUES ($1,$2,$3,$4,$5,$6,true,now(),'127.0.0.1')`, [id(4),id(2),id(1),cifrar('Cliente Sintético'),cifrar('66999999999'),cifrar('cliente@example.test')]);
    for (const [numero,papel,documento] of [[5,'OWNER','52998224725'],[6,'TENANT','11222333000181']] as const) {
      await executor.query(`INSERT INTO rental_parties (id,kind,person_type,name,private_data) VALUES ($1,$2,$3,'Pessoa Sintética',$4)`,
        [id(numero),papel,papel === 'OWNER' ? 'PF' : 'PJ',cifrar(JSON.stringify({ taxId: documento, email: 'pessoa@example.test', phone: '66999999999', address: 'Rua Teste', birthDate: '', bankName: 'Banco Teste', bankAgency: '001', bankAccount: '002', pixKey: 'pessoa@example.test', notes: 'Observação privada' }), 'rental-administration:v1:')]);
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
    const ambienteApi: Record<string, string> = {
      DATABASE_URL: conexao, NODE_ENV: 'test', JWT_SECRET: 'segredo-jwt-sintetico-apenas-homologacao', JWT_EXPIRES_IN: '15m',
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

  it('mapeia todas entidades e mantém credenciais, IDs, slugs e campos pessoais decifrados', async () => {
    for (const entidade of entidades) await executor.manager.getRepository(entidade).find({ take: 1 });
    const corretor = await executor.manager.getRepository(Corretor).createQueryBuilder('corretor').addSelect('corretor.senha_hash').getOneOrFail();
    expect(corretor).toMatchObject({ id: id(1), cargo: 'ADMIN', cpf: '52998224725', senha_hash: 'hash-legado-preservado' });
    expect(await executor.manager.findOneByOrFail(Cliente, { id: id(4) })).toMatchObject({ nome: 'Cliente Sintético', telefone: '66999999999', email: 'cliente@example.test' });
    expect(await executor.manager.findOneByOrFail(ParteLocacao, { id: id(5) })).toMatchObject({ cpf_cnpj: '52998224725', banco_nome: 'Banco Teste', observacoes: 'Observação privada' });
    expect(await executor.manager.findOneByOrFail(Contrato, { id: id(7) })).toMatchObject({ status: 'ATIVO', observacoes: 'Observações contrato', taxa_administracao: '8.00' });
    const [tag] = await executor.query('SELECT valor FROM imoveis_caracteristicas') as Array<{ valor: string }>;
    expect(tag.valor).toBe('4');
  });

  it('protege unicidade de contrato ativo, capa, parcelas e relações históricas', async () => {
    await recusar(`INSERT INTO contrato SELECT $1,'LOC-DUPLICADO',imovel_id,locador_id,locatario_id,corretor_id,data_inicio,data_fim,valor_aluguel,dia_vencimento,taxa_administracao,garantia_locaticia,indice_reajuste,cobranca_iptu_condominio,url_pasta_drive,status,observacoes,ativo,status_pasta_drive,criado_em,alterado_em,criado_por,alterado_por FROM contrato LIMIT 1`, [id(11)], '23505');
    await recusar(`INSERT INTO imoveis_midias (imovel_id,tipo,url,capa,criado_por) VALUES ($1,'IMAGEM','https://example.test/outra.webp',true,$2)`, [id(2),id(1)], '23505');
    await recusar('DELETE FROM partes_locacao WHERE id=$1', [id(5)], '23503');
    await recusar(`UPDATE imoveis SET area_total=1 WHERE id=$1`, [id(2)], '23514');
    await recusar(`UPDATE parcelas_comissao SET valor=0 WHERE id=$1`, [id(9)], '23514');
    await recusar(`UPDATE parcelas_comissao SET pago_em=NULL WHERE id=$1`, [id(9)], '23514');
  });

  it('retém documentos antigos fora do schema operacional sem campo privado no novo cadastro', async () => {
    const [contagem] = await executor.query('SELECT count(*)::int AS total FROM legado_20260913.rental_documents') as Array<{ total: number }>;
    expect(contagem.total).toBe(1);
    const colunas = await executor.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='partes_locacao'") as Array<{ column_name: string }>;
    expect(colunas.map(coluna => coluna.column_name)).not.toContain('private_data');
    const [antigo] = await executor.query("SELECT to_regclass('public.rental_documents') AS tabela") as Array<{ tabela: string | null }>;
    expect(antigo.tabela).toBeNull();
  });

  it('integra login, consulta pública, criação manual e comissões HTTP com repositórios reais', async () => {
    expect((await fetch(`${origem}/saude`)).status).toBe(200);
    const senha = 'Senha-Sintetica-123!';
    await executor.manager.update(Corretor, { id: id(1) }, { senha_hash: await new SenhasService().gerarHash(senha) });
    const entrar = await fetch(`${origem}/autenticacao/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', senha }) });
    expect(entrar.status).toBe(200);
    const sessao = await entrar.json() as { token_acesso: string };
    expect(entrar.headers.get('set-cookie')).toEqual(expect.stringContaining('HttpOnly'));
    expect(entrar.headers.get('set-cookie')).toEqual(expect.stringContaining('Secure'));
    expect((await fetch(`${origem}/admin/clientes`)).status).toBe(401);
    const catalogo = await fetch(`${origem}/imoveis`);
    expect(catalogo.status).toBe(200);
    const texto = await catalogo.text();
    expect(texto).toContain('Sala de Teste');
    expect(texto).not.toContain('cpf');
    const cabecalhos = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.token_acesso}` };
    const criar = await fetch(`${origem}/admin/clientes`, { method: 'POST', headers: cabecalhos, body: JSON.stringify({ nome: 'Cliente Manual HTTP', telefone: '66999999999' }) });
    expect(criar.status).toBe(201);
    const cliente = await criar.json() as { id: string; consentimento: boolean };
    expect(cliente.consentimento).toBe(false);
    const comissao = await fetch(`${origem}/admin/comissoes`, { method: 'POST', headers: cabecalhos, body: JSON.stringify({ tipo_operacao: 'VENDA', imovel_id: id(2), cliente_id: cliente.id, valor_total: '100.00', quantidade_parcelas: 3, primeiro_vencimento: '2030-01-31' }) });
    expect(comissao.status).toBe(201);
    const receita = await comissao.json() as { parcelas: Array<{ id: string; valor: string; data_vencimento: string }> };
    expect(receita.parcelas.map(parcela => parcela.valor)).toEqual(['33.34', '33.33', '33.33']);
    expect(receita.parcelas.map(parcela => parcela.data_vencimento)).toEqual(['2030-01-31','2030-02-28','2030-03-31']);
    const baixa = await fetch(`${origem}/admin/comissoes/parcelas/${receita.parcelas[0].id}/pagamento`, { method: 'PATCH', headers: cabecalhos, body: JSON.stringify({ confirmar_pagamento: true, observacao_pagamento: 'Comprovante sintético' }) });
    expect(baixa.status).toBe(200);
    expect(await baixa.json()).toMatchObject({ status: 'PAGO' });
  }, 30000);
});
