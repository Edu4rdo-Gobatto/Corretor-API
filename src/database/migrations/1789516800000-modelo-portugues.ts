import { MigrationInterface, QueryRunner } from 'typeorm';
import { copiarLegado, prepararLegado } from '../migracao-legado';

const auditoria = `criado_em timestamptz NOT NULL DEFAULT now(), alterado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NULL REFERENCES corretores(id) ON DELETE RESTRICT, alterado_por uuid NULL REFERENCES corretores(id) ON DELETE RESTRICT`;

export class ModeloPortugues1789516800000 implements MigrationInterface {
  name = 'ModeloPortugues1789516800000';

  async up(executor: QueryRunner): Promise<void> {
    const complementos = await prepararLegado(executor);
    await executor.query(`CREATE TYPE cargo_corretor AS ENUM ('ADMIN','CORRETOR');
      CREATE TYPE status_imovel AS ENUM ('DISPONIVEL','RESERVADO','CONCLUIDO');
      CREATE TYPE tipo_midia AS ENUM ('IMAGEM','VIDEO_EMBED','VIDEO_ARQUIVO');
      CREATE TYPE origem_cliente AS ENUM ('SITE','MANUAL');
      CREATE TYPE papel_parte_locacao AS ENUM ('LOCADOR','LOCATARIO');
      CREATE TYPE tipo_pessoa AS ENUM ('PF','PJ');
      CREATE TYPE status_contrato AS ENUM ('ATIVO','INATIVO');
      CREATE TYPE tipo_operacao_comissao AS ENUM ('LOCACAO','VENDA');
      CREATE TYPE status_parcela_comissao AS ENUM ('PENDENTE','PAGO','ATRASADO')`);
    await executor.query(`CREATE TABLE corretores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 100),
      email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))), senha_hash text NOT NULL,
      cpf text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'), whatsapp text NOT NULL, creci text NULL,
      cargo cargo_corretor NOT NULL DEFAULT 'CORRETOR', url_foto text NULL, ativo boolean NOT NULL DEFAULT true, ${auditoria}
    )`);
    for (const tabela of ['tipos_imovel', 'finalidades_imovel']) {
      await executor.query(`CREATE TABLE ${tabela} (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL UNIQUE, slug text NOT NULL UNIQUE, ativo boolean NOT NULL DEFAULT true, ${auditoria})`);
    }
    await executor.query(`CREATE TABLE caracteristicas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL UNIQUE, icone text NULL, ativo boolean NOT NULL DEFAULT true, ${auditoria})`);
    await executor.query(`CREATE TABLE imoveis (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 3 AND 200), slug text NOT NULL UNIQUE,
      tipo_id uuid NOT NULL REFERENCES tipos_imovel(id) ON DELETE RESTRICT,
      finalidade_id uuid NOT NULL REFERENCES finalidades_imovel(id) ON DELETE RESTRICT,
      valor numeric(12,2) NOT NULL CHECK (valor >= 0), valor_condominio numeric(10,2) NULL CHECK (valor_condominio >= 0), valor_iptu numeric(10,2) NULL CHECK (valor_iptu >= 0),
      area_util numeric(10,2) NOT NULL CHECK (area_util > 0), area_total numeric(10,2) NOT NULL CHECK (area_total >= area_util),
      cep text NULL, logradouro text NOT NULL, numero text NOT NULL, complemento text NULL, bairro text NOT NULL, cidade text NOT NULL,
      estado text NOT NULL CHECK (estado ~ '^[A-Z]{2}$'), descricao text NOT NULL CHECK (char_length(descricao) <= 20000),
      status status_imovel NOT NULL DEFAULT 'DISPONIVEL', corretor_id uuid NOT NULL REFERENCES corretores(id) ON DELETE RESTRICT,
      ativo boolean NOT NULL DEFAULT true, ${auditoria}
    )`);
    await executor.query(`CREATE TABLE imoveis_caracteristicas (
      imovel_id uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE, caracteristica_id uuid NOT NULL REFERENCES caracteristicas(id) ON DELETE RESTRICT,
      valor text NULL, ativo boolean NOT NULL DEFAULT true, ${auditoria}, PRIMARY KEY (imovel_id,caracteristica_id)
    )`);
    await executor.query(`CREATE TABLE imoveis_midias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), imovel_id uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
      tipo tipo_midia NOT NULL, url text NOT NULL, chave_armazenamento text NULL, ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
      capa boolean NOT NULL DEFAULT false CHECK (NOT capa OR tipo='IMAGEM'), ${auditoria}
    )`);
    await executor.query('ALTER TABLE imoveis_midias ALTER COLUMN criado_por SET NOT NULL');
    await executor.query(`CREATE UNIQUE INDEX unica_capa_imovel ON imoveis_midias (imovel_id) WHERE capa=true`);
    await executor.query(`CREATE TABLE clientes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), imovel_id uuid NULL REFERENCES imoveis(id) ON DELETE SET NULL,
      corretor_id uuid NOT NULL REFERENCES corretores(id) ON DELETE RESTRICT, nome text NOT NULL, telefone text NOT NULL, email text NULL, mensagem text NULL,
      origem origem_cliente NOT NULL DEFAULT 'SITE', consentimento boolean NOT NULL DEFAULT false, consentimento_ip text NULL,
      consentimento_em timestamptz NULL, versao_termos text NULL DEFAULT 'v1.0', ativo boolean NOT NULL DEFAULT true, ${auditoria},
      CONSTRAINT consentimento_site CHECK (origem <> 'SITE' OR (consentimento AND consentimento_em IS NOT NULL))
    )`);
    await executor.query(`CREATE TABLE sessoes_login (
      token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'), corretor_id uuid NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      expira_em timestamptz NOT NULL, ${auditoria}
    )`);
    await executor.query(`CREATE TABLE partes_locacao (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), papel papel_parte_locacao NOT NULL, tipo_pessoa tipo_pessoa NOT NULL,
      nome text NOT NULL, cpf_cnpj text NOT NULL CHECK ((tipo_pessoa='PF' AND cpf_cnpj ~ '^[0-9]{11}$') OR (tipo_pessoa='PJ' AND cpf_cnpj ~ '^[0-9]{14}$')),
      email text NULL, telefone text NULL, endereco text NULL, data_nascimento date NULL, banco_nome text NULL, banco_agencia text NULL,
      banco_conta text NULL, chave_pix text NULL, observacoes text NULL, ativo boolean NOT NULL DEFAULT true, ${auditoria}
    )`);
    await executor.query(`CREATE TABLE contrato (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero_contrato text NOT NULL UNIQUE,
      imovel_id uuid NOT NULL REFERENCES imoveis(id) ON DELETE RESTRICT, locador_id uuid NOT NULL REFERENCES partes_locacao(id) ON DELETE RESTRICT,
      locatario_id uuid NOT NULL REFERENCES partes_locacao(id) ON DELETE RESTRICT, corretor_id uuid NOT NULL REFERENCES corretores(id) ON DELETE RESTRICT,
      data_inicio date NOT NULL, data_fim date NOT NULL CHECK (data_fim >= data_inicio), valor_aluguel numeric(12,2) NOT NULL CHECK (valor_aluguel > 0),
      dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31), taxa_administracao numeric(5,2) NOT NULL CHECK (taxa_administracao BETWEEN 0 AND 100),
      garantia_locaticia text NOT NULL, indice_reajuste text NOT NULL, cobranca_iptu_condominio text NOT NULL, url_pasta_drive text NULL,
      status status_contrato NOT NULL DEFAULT 'ATIVO', observacoes text NULL, ativo boolean NOT NULL DEFAULT true,
      status_pasta_drive text NOT NULL DEFAULT 'PENDENTE' CHECK (status_pasta_drive IN ('PENDENTE','CRIADA','FALHOU')), ${auditoria},
      CONSTRAINT partes_distintas CHECK (locador_id <> locatario_id), CONSTRAINT contrato_arquivado CHECK (ativo OR status='INATIVO')
    )`);
    await executor.query(`CREATE UNIQUE INDEX unico_contrato_ativo_imovel ON contrato (imovel_id) WHERE status='ATIVO'`);
    await executor.query(`CREATE TABLE comissoes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo_operacao tipo_operacao_comissao NOT NULL,
      contrato_id uuid NULL REFERENCES contrato(id) ON DELETE RESTRICT, imovel_id uuid NOT NULL REFERENCES imoveis(id) ON DELETE RESTRICT,
      cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT, valor_total numeric(12,2) NOT NULL CHECK (valor_total > 0),
      quantidade_parcelas integer NOT NULL CHECK (quantidade_parcelas BETWEEN 1 AND 600), observacoes text NULL,
      ativo boolean NOT NULL DEFAULT true, ${auditoria},
      CONSTRAINT comissao_operacao_contrato CHECK ((tipo_operacao='LOCACAO' AND contrato_id IS NOT NULL) OR (tipo_operacao='VENDA' AND contrato_id IS NULL))
    )`);
    await executor.query(`CREATE TABLE parcelas_comissao (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), comissao_id uuid NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE,
      numero_parcela integer NOT NULL CHECK (numero_parcela >= 1), data_vencimento date NOT NULL, valor numeric(12,2) NOT NULL CHECK (valor > 0),
      status status_parcela_comissao NOT NULL DEFAULT 'PENDENTE', pago_em timestamptz NULL, observacao_pagamento text NULL,
      ativo boolean NOT NULL DEFAULT true, ${auditoria}, UNIQUE (comissao_id,numero_parcela),
      CONSTRAINT parcela_pagamento CHECK ((status='PAGO' AND pago_em IS NOT NULL) OR (status<>'PAGO' AND pago_em IS NULL))
    )`);
    await executor.query(`CREATE TABLE pastas_drive (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chave text NOT NULL UNIQUE, id_drive text NOT NULL UNIQUE,
      pasta_pai_id text NOT NULL, nome text NOT NULL, ativo boolean NOT NULL DEFAULT true, ${auditoria}
    )`);
    await executor.query(`INSERT INTO tipos_imovel (nome,slug) VALUES ('Galpão','galpao'),('Sala Comercial','sala-comercial'),('Prédio','predio'),('Loja','loja'),('Terreno','terreno');
      INSERT INTO finalidades_imovel (nome,slug) VALUES ('Locação','locacao'),('Venda','venda'),('Locação e Venda','locacao-e-venda')`);
    await executor.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    for (const [tabela, coluna] of [['corretores','nome'],['imoveis','titulo'],['imoveis','cidade'],['clientes','nome'],['partes_locacao','nome'],['partes_locacao','cpf_cnpj']]) {
      await executor.query(`CREATE INDEX busca_${tabela}_${coluna} ON ${tabela} USING gin (${coluna} gin_trgm_ops)`);
    }
    for (const [tabela, colunas] of [['imoveis','status,ativo,criado_em,id'],['imoveis','corretor_id'],['imoveis','tipo_id,finalidade_id,valor'],['imoveis_midias','imovel_id,ordem,id'],['clientes','corretor_id,criado_em,id'],['clientes','imovel_id'],['sessoes_login','expira_em'],['sessoes_login','corretor_id'],['partes_locacao','cpf_cnpj'],['contrato','locador_id,status'],['contrato','locatario_id,status'],['contrato','corretor_id'],['contrato','status,data_fim'],['comissoes','contrato_id'],['comissoes','imovel_id'],['comissoes','cliente_id'],['parcelas_comissao','status,data_vencimento']]) {
      await executor.query(`CREATE INDEX indice_${tabela}_${colunas.replaceAll(',', '_')} ON ${tabela} (${colunas})`);
    }
    await copiarLegado(executor, complementos);
  }

  down(): Promise<void> {
    return Promise.reject(new Error('Reversão automática recusada: restaure backup verificado em ambiente isolado e faça corte coordenado; dados novos não podem ser apagados.'));
  }
}
