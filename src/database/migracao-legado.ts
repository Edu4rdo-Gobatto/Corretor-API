import { createDecipheriv, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { QueryRunner } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { isUUID, validateSync } from 'class-validator';
import { ClienteManualDto } from '../clientes/clientes.dto';
import { documentoValido } from '../comum/validacao';

type Registro = Record<string, unknown>;
export interface ComplementosLegado {
  corretores: Record<string, { cpf: string }>;
  contratos: Record<string, Registro>;
  comissoes: Record<string, Registro>;
  clientes_manuais: Record<string, ClienteManualDto>;
  responsavel_migracao?: string;
}

function registro(valor: unknown): Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Registro : {};
}

export function validarComplementos(entrada: unknown, corretores: string[]): ComplementosLegado {
  const dados = registro(entrada);
  const mapa = registro(dados.corretores);
  const resultado: ComplementosLegado = { corretores: {}, contratos: {}, comissoes: {}, clientes_manuais: {} };
  for (const id of corretores) {
    const cpf = registro(mapa[id]).cpf;
    if (typeof cpf !== 'string' || cpf.length !== 11 || !documentoValido(cpf)) {
      throw new Error('Migração interrompida: informe CPF válido de todos os corretores em MIGRACAO_COMPLEMENTOS_ARQUIVO. Nenhum dado foi alterado.');
    }
    resultado.corretores[id] = { cpf };
  }
  for (const grupo of ['contratos', 'comissoes'] as const) {
    for (const [id, valor] of Object.entries(registro(dados[grupo]))) resultado[grupo][id] = registro(valor);
  }
  if (typeof dados.responsavel_migracao === 'string') resultado.responsavel_migracao = dados.responsavel_migracao;
  for (const [id, valor] of Object.entries(registro(dados.clientes_manuais))) {
    const cliente = plainToInstance(ClienteManualDto, registro(valor));
    if (!isUUID(id, '4') || !cliente.corretor_id || validateSync(cliente, { whitelist: true, forbidNonWhitelisted: true, validationError: { target: false, value: false } }).length) {
      throw new Error('Migração interrompida: complemento de cliente manual inválido; informe ID, atendente, nome e telefone reais, sem campos de consentimento.');
    }
    resultado.clientes_manuais[id] = cliente;
  }
  return resultado;
}

export function decifrarTextoLegado(valor: string | null, segredo: string | undefined, dominio = ''): string | null {
  if (valor === null || !valor.startsWith(dominio ? 'rental:v1:' : 'enc:v1:')) return valor;
  try {
    if (!segredo) throw new Error();
    const prefixo = dominio ? 'rental:v1:' : 'enc:v1:';
    const [iv, etiqueta, conteudo] = valor.slice(prefixo.length).split('.');
    const chave = createHash('sha256').update(dominio).update(segredo).digest();
    const decifrador = createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64url'));
    decifrador.setAuthTag(Buffer.from(etiqueta, 'base64url'));
    return Buffer.concat([decifrador.update(Buffer.from(conteudo, 'base64url')), decifrador.final()]).toString('utf8');
  } catch {
    throw new Error('Não foi possível decifrar dados legados. Verifique LEADS_ENCRYPTION_KEY original; nenhuma chave deve ser trocada.');
  }
}

export async function prepararLegado(executor: QueryRunner): Promise<ComplementosLegado> {
  // Bloqueia escritores antigos até a transação terminar, evitando cópia parcial durante o corte.
  await executor.query('LOCK TABLE agents, properties, property_media, leads, refresh_sessions, rental_parties, leases, rental_documents, acquisition_commissions, commission_installments, rent_payments IN ACCESS EXCLUSIVE MODE');
  const corretores = await executor.query('SELECT id FROM agents') as Array<{ id: string }>;
  let dados: unknown = {};
  const arquivo = process.env.MIGRACAO_COMPLEMENTOS_ARQUIVO;
  if (arquivo) {
    try { dados = JSON.parse(await readFile(arquivo, 'utf8')) as unknown; }
    catch { throw new Error('MIGRACAO_COMPLEMENTOS_ARQUIVO deve apontar para JSON local válido, fora do controle de versão.'); }
  }
  const complementos = validarComplementos(dados, corretores.map(item => item.id));
  const [schemaAtual] = await executor.query('SELECT current_schema() AS nome') as Array<{ nome: string }>;
  if (schemaAtual.nome !== 'public') throw new Error('Migração interrompida: use o schema public em uma database isolada para homologação.');
  const contratos = await executor.query('SELECT id FROM leases') as Array<{ id: string }>;
  for (const { id } of contratos) {
    const adicional = complementos.contratos[id];
    if (!adicional || ['corretor_id', 'taxa_administracao', 'garantia_locaticia', 'indice_reajuste', 'cobranca_iptu_condominio'].some(campo => typeof adicional[campo] !== 'string' || !adicional[campo])) {
      throw new Error('Migração interrompida: contratos legados exigem complementos explícitos de intermediação, taxa, garantia, reajuste e encargos.');
    }
  }
  const comissoes = await executor.query('SELECT id FROM acquisition_commissions') as Array<{ id: string }>;
  if (comissoes.some(({ id }) => typeof complementos.comissoes[id]?.cliente_id !== 'string')) {
    throw new Error('Migração interrompida: informe cliente_id de cada comissão legada.');
  }
  const midias = await executor.query('SELECT count(*)::int AS total FROM property_media') as Array<{ total: number }>;
  if (midias[0].total > 0 && !corretores.some(item => item.id === complementos.responsavel_migracao)) {
    throw new Error('Migração interrompida: informe responsavel_migracao existente para a auditoria das mídias históricas.');
  }
  return complementos;
}

export async function copiarLegado(executor: QueryRunner, dados: ComplementosLegado): Promise<void> {
  for (const [id, { cpf }] of Object.entries(dados.corretores)) {
    await executor.query(`INSERT INTO corretores (id,nome,email,senha_hash,cpf,whatsapp,creci,cargo,url_foto,ativo,criado_em,alterado_em)
      SELECT id,name,email,password_hash,$2,whatsapp_number,creci,(CASE role::text WHEN 'ADMIN' THEN 'ADMIN' ELSE 'CORRETOR' END)::cargo_corretor,avatar_url,active,created_at,created_at FROM agents WHERE id=$1`, [id, cpf]);
  }
  await executor.query(`INSERT INTO imoveis (id,titulo,slug,tipo_id,finalidade_id,valor,valor_condominio,valor_iptu,area_util,area_total,logradouro,numero,bairro,cidade,estado,descricao,status,corretor_id,criado_em,alterado_em)
    SELECT p.id,p.title,p.slug,t.id,f.id,p.price,p.condo_fee,p.iptu_fee,p.usable_area,p.total_area,p.address_street,p.address_number,p.neighborhood,p.address_city,p.address_state,p.description,p.status::text::status_imovel,p.agent_id,p.created_at,p.updated_at
    FROM properties p JOIN tipos_imovel t ON t.slug=CASE p.type::text WHEN 'GALPAO' THEN 'galpao' WHEN 'SALA' THEN 'sala-comercial' WHEN 'PREDIO' THEN 'predio' WHEN 'LOJA' THEN 'loja' WHEN 'TERRENO' THEN 'terreno' END
    JOIN finalidades_imovel f ON f.slug=CASE p.purpose::text WHEN 'LOCACAO' THEN 'locacao' WHEN 'VENDA' THEN 'venda' END`);
  await executor.query(`INSERT INTO caracteristicas (nome) SELECT DISTINCT chave FROM properties CROSS JOIN LATERAL jsonb_each_text(features) AS caracteristica(chave,valor) ON CONFLICT (nome) DO NOTHING`);
  await executor.query(`INSERT INTO imoveis_caracteristicas (imovel_id,caracteristica_id,valor) SELECT p.id,c.id,caracteristica.valor FROM properties p CROSS JOIN LATERAL jsonb_each_text(p.features) AS caracteristica(chave,valor) JOIN caracteristicas c ON c.nome=caracteristica.chave`);
  await executor.query(`INSERT INTO imoveis_midias (id,imovel_id,tipo,url,chave_armazenamento,ordem,capa,criado_por,alterado_por)
    SELECT id,property_id,(CASE type::text WHEN 'IMAGE' THEN 'IMAGEM' WHEN 'VIDEO_FILE' THEN 'VIDEO_ARQUIVO' ELSE 'VIDEO_EMBED' END)::tipo_midia,url,storage_key,order_index,is_cover,$1,$1 FROM property_media`, [dados.responsavel_migracao ?? null]);
  const segredo = process.env.LEADS_ENCRYPTION_KEY;
  const contatos = await executor.query('SELECT * FROM leads') as Array<{ id: string; property_id: string | null; agent_id: string; lead_name: string; lead_phone: string; lead_email: string | null; message: string | null; consent_given: boolean; consent_timestamp: Date; consent_ip: string; terms_version: string; created_at: Date }>;
  for (const contato of contatos) {
    await executor.query(`INSERT INTO clientes (id,imovel_id,corretor_id,nome,telefone,email,mensagem,origem,consentimento,consentimento_ip,consentimento_em,versao_termos,criado_em,alterado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,'SITE',$8,$9,$10,$11,$12,$12)`,
      [contato.id,contato.property_id,contato.agent_id,decifrarTextoLegado(contato.lead_name,segredo),decifrarTextoLegado(contato.lead_phone,segredo),decifrarTextoLegado(contato.lead_email,segredo),contato.message,contato.consent_given,contato.consent_ip,contato.consent_timestamp,contato.terms_version,contato.created_at]);
  }
  for (const [id, cliente] of Object.entries(dados.clientes_manuais)) {
    await executor.query(`INSERT INTO clientes (id,imovel_id,corretor_id,nome,telefone,email,mensagem,origem,consentimento,consentimento_ip,consentimento_em,versao_termos,criado_por,alterado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'MANUAL',false,NULL,NULL,NULL,$8,$8)`,
      [id,cliente.imovel_id ?? null,cliente.corretor_id,cliente.nome,cliente.telefone,cliente.email ?? null,cliente.mensagem ?? null,dados.responsavel_migracao ?? null]);
  }
  const partes = await executor.query('SELECT * FROM rental_parties') as Array<{ id: string; kind: string; person_type: string; name: string; private_data: string; active: boolean; created_at: Date; updated_at: Date }>;
  for (const parte of partes) {
    const privado = registro(JSON.parse(decifrarTextoLegado(parte.private_data, segredo, 'rental-administration:v1:') ?? '{}') as unknown);
    if (typeof privado.taxId !== 'string' || !documentoValido(privado.taxId)) throw new Error('Migração interrompida: há CPF/CNPJ legado inválido; corrigir origem antes de migrar.');
    await executor.query(`INSERT INTO partes_locacao (id,papel,tipo_pessoa,nome,cpf_cnpj,email,telefone,endereco,data_nascimento,banco_nome,banco_agencia,banco_conta,chave_pix,observacoes,ativo,criado_em,alterado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [parte.id,parte.kind === 'OWNER' ? 'LOCADOR' : 'LOCATARIO',parte.person_type,parte.name,privado.taxId,privado.email || null,privado.phone || null,privado.address || null,privado.birthDate || null,privado.bankName || null,privado.bankAgency || null,privado.bankAccount || null,privado.pixKey || null,privado.notes || null,parte.active,parte.created_at,parte.updated_at]);
  }
  const contratos = await executor.query('SELECT * FROM leases') as Array<{ id: string; reference: string; property_id: string; owner_id: string; tenant_id: string; start_date: string; end_date: string; rent_amount: string; due_day: number; status: string; notes: string; created_at: Date; updated_at: Date }>;
  for (const contrato of contratos) {
    const adicional = dados.contratos[contrato.id];
    const notas = decifrarTextoLegado(contrato.notes, segredo, 'rental-administration:v1:');
    const observacoes: unknown = notas?.startsWith('"') ? JSON.parse(notas) as unknown : notas;
    await executor.query(`INSERT INTO contrato (id,numero_contrato,imovel_id,locador_id,locatario_id,corretor_id,data_inicio,data_fim,valor_aluguel,dia_vencimento,taxa_administracao,garantia_locaticia,indice_reajuste,cobranca_iptu_condominio,status,observacoes,criado_em,alterado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $15='ACTIVE' AND $8::date >= (now() AT TIME ZONE 'America/Cuiaba')::date THEN 'ATIVO'::status_contrato ELSE 'INATIVO'::status_contrato END,$16,$17,$18)`,
      [contrato.id,contrato.reference,contrato.property_id,contrato.owner_id,contrato.tenant_id,adicional.corretor_id,contrato.start_date,contrato.end_date,contrato.rent_amount,contrato.due_day,adicional.taxa_administracao,adicional.garantia_locaticia,adicional.indice_reajuste,adicional.cobranca_iptu_condominio,contrato.status,observacoes,contrato.created_at,contrato.updated_at]);
  }
  for (const [id, adicional] of Object.entries(dados.comissoes)) {
    await executor.query(`INSERT INTO comissoes (id,tipo_operacao,contrato_id,imovel_id,cliente_id,valor_total,quantidade_parcelas,observacoes,criado_em,alterado_em)
      SELECT a.id,'LOCACAO',a.lease_id,c.imovel_id,$2,a.total_amount,a.installment_count,a.notes,a.created_at,a.updated_at FROM acquisition_commissions a JOIN contrato c ON c.id=a.lease_id WHERE a.id=$1`, [id,adicional.cliente_id]);
  }
  await executor.query(`INSERT INTO parcelas_comissao (id,comissao_id,numero_parcela,data_vencimento,valor,status,pago_em,observacao_pagamento)
    SELECT id,commission_id,installment_number,due_date,amount,(CASE WHEN status::text='PAID' THEN 'PAGO' WHEN due_date < (now() AT TIME ZONE 'America/Cuiaba')::date THEN 'ATRASADO' ELSE 'PENDENTE' END)::status_parcela_comissao,paid_at,payment_note FROM commission_installments`);
  // Sessões antigas ficam no arquivo; a mudança de contrato/cargo exige novo login.
  await executor.query('CREATE SCHEMA legado_20260913');
  for (const tabela of ['agents','properties','property_media','leads','refresh_sessions','rental_parties','leases','rental_documents','acquisition_commissions','commission_installments','rent_payments']) {
    await executor.query(`ALTER TABLE public.${tabela} SET SCHEMA legado_20260913`);
  }
  for (const tipo of ['AgentRole','PropertyType','PropertyPurpose','PropertyStatus','MediaType','CommissionInstallmentStatus','RentPaymentStatus']) {
    await executor.query(`ALTER TYPE public."${tipo}" SET SCHEMA legado_20260913`);
  }
  await executor.query('REVOKE ALL ON SCHEMA legado_20260913 FROM PUBLIC');
}
