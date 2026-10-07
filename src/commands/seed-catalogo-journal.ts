import { randomBytes, randomInt } from 'node:crypto';
import { join } from 'node:path';
import { EntityManager } from 'typeorm';
import { CargoCorretor, Corretor } from '../corretores/corretor.entity';
import { CriarCorretorDto } from '../corretores/corretores.dto';
import { CorretoresService } from '../corretores/corretores.service';
import { SenhasService } from '../corretores/senhas.service';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { catalogoCarga, caracteristicasCarga } from './seed-catalogo-dados';
import { exigir, existe, gravarPrivado, hash, lerJson, objeto, validarDto } from './seed-catalogo-arquivos';

export const LOTE = 'catalogo:2026-10-03';
const EMAIL = 'codice@demo.invalid';
export const ARQUIVO_JOURNAL = 'catalogo-journal.json';
const ARQUIVO_CREDENCIAIS = 'codice-credenciais.json';
export type Destino = { host: string; banco: string };
export type FotoPrivada = { sha256: string; tamanho: number; mimetype: string; chave?: string };
export type ItemPrivado = { manifesto: string; dto: string; id?: number; snapshot?: string; estado: 'preparado' | 'publicando' | 'concluido'; fotos: FotoPrivada[] };
type ContaPrivada = { cpf: string; whatsapp: string; id?: number };
export type Journal = { versao: 1; lote: string; destino: Destino; manifesto: string; conta?: ContaPrivada; itens: Record<string, ItemPrivado> };

export async function carregarJournal(diretorio: string | undefined, destino: Destino): Promise<Journal> {
  const manifesto = hash(JSON.stringify({ catalogoCarga, caracteristicasCarga }));
  const novo: Journal = { versao: 1, lote: LOTE, destino, manifesto, itens: {} };
  if (!diretorio || !await existe(join(diretorio, ARQUIVO_JOURNAL))) return novo;
  const valor = await lerJson(join(diretorio, ARQUIVO_JOURNAL));
  exigir(objeto(valor) && valor.versao === 1 && valor.lote === LOTE && valor.manifesto === manifesto && objeto(valor.destino)
    && valor.destino.host === destino.host && valor.destino.banco === destino.banco && objeto(valor.itens), 'Journal incompatível com o manifesto ou destino.');
  const journal = valor as Journal;
  for (const [chave, item] of Object.entries(journal.itens)) {
    exigir(catalogoCarga.some(dados => dados.chave === chave) && objeto(item) && ['preparado', 'publicando', 'concluido'].includes(item.estado)
      && /^[0-9a-f]{64}$/.test(item.dto) && /^[0-9a-f]{64}$/.test(item.manifesto) && Array.isArray(item.fotos) && item.fotos.length === 3
      && (item.id === undefined || (Number.isSafeInteger(item.id) && item.id > 0)) && (item.snapshot === undefined || /^[0-9a-f]{64}$/.test(item.snapshot))
      && item.fotos.every(f => objeto(f) && /^[0-9a-f]{64}$/.test(f.sha256) && Number.isInteger(f.tamanho) && f.tamanho > 0 && f.tamanho <= 10 * 1024 * 1024
        && ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype) && (f.chave === undefined || /^imoveis\/\d+\/[a-z0-9-]+\.(jpg|png|webp)$/.test(f.chave))), 'Journal privado inválido.');
  }
  if (journal.conta) exigir(/^\d{11}$/.test(journal.conta.cpf) && journal.conta.whatsapp === '5566984346427'
    && (journal.conta.id === undefined || (Number.isSafeInteger(journal.conta.id) && journal.conta.id > 0)), 'Conta do journal privado inválida.');
  return journal;
}

function gerarCpf(): string {
  const numeros = Array.from({ length: 9 }, () => randomInt(0, 10));
  const digito = () => { const resto = numeros.reduce((soma, numero, indice) => soma + numero * (numeros.length + 1 - indice), 0) % 11; return resto < 2 ? 0 : 11 - resto; };
  numeros.push(digito()); numeros.push(digito());
  return numeros.join('');
}

export async function contaExistente(manager: EntityManager, journal: Journal): Promise<Corretor | null> {
  const conta = await manager.getRepository(Corretor).findOneBy({ email: EMAIL });
  if (conta) exigir(journal.conta && conta.nome === 'Codice' && conta.cargo === CargoCorretor.ADMIN && conta.ativo
    && conta.cpf === journal.conta.cpf && conta.whatsapp === journal.conta.whatsapp && conta.criado_por === 1
    && (!journal.conta.id || journal.conta.id === conta.id), 'Conta Codice existente diverge da carga; nenhuma senha ou perfil será alterado.');
  if (!conta) exigir(!journal.conta?.id, 'Conta previamente criada não foi encontrada; restauração automática recusada.');
  return conta;
}

export async function prepararConta(manager: EntityManager, journal: Journal, diretorio: string, salvar: () => Promise<void>, usuario: UsuarioAutenticado): Promise<number> {
  let conta = await contaExistente(manager, journal);
  if (!conta) {
    if (!journal.conta) {
      let cpf = gerarCpf();
      while (/^(\d)\1+$/.test(cpf) || await manager.getRepository(Corretor).existsBy({ cpf })) cpf = gerarCpf();
      const senha = randomBytes(32).toString('base64url');
      journal.conta = { cpf, whatsapp: '5566984346427' };
      exigir(!await existe(join(diretorio, ARQUIVO_CREDENCIAIS)), 'Credenciais sem journal: revisão privada necessária antes de continuar.');
      await gravarPrivado(diretorio, ARQUIVO_CREDENCIAIS, JSON.stringify({ versao: 1, lote: LOTE, destino: journal.destino, nome: 'Codice', email: EMAIL, cpf, whatsapp: journal.conta.whatsapp, senha }, null, 2));
      await salvar();
    }
    const credencial = await lerJson(join(diretorio, ARQUIVO_CREDENCIAIS));
    exigir(objeto(credencial) && credencial.lote === LOTE && credencial.cpf === journal.conta.cpf && credencial.email === EMAIL && typeof credencial.senha === 'string' && credencial.senha.length >= 24, 'Credenciais privadas incompatíveis com o journal.');
    const dto = validarDto(CriarCorretorDto, { nome: 'Codice', email: EMAIL, senha: (credencial as Record<string, unknown>).senha, cpf: journal.conta.cpf, whatsapp: journal.conta.whatsapp, cargo: CargoCorretor.ADMIN });
    const criada = await new CorretoresService(manager.getRepository(Corretor), new SenhasService()).criar(dto, usuario);
    conta = await manager.getRepository(Corretor).findOneByOrFail({ id: criada.id });
  }
  journal.conta!.id = conta.id;
  await salvar();
  return conta.id;
}
