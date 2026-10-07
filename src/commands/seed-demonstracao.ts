import 'reflect-metadata';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import { ImovelCaracteristica } from '../cadastros/cadastros.entity';
import { createPostgresOptions } from '../config/database.config';
import { validateEnvironment } from '../config/env.validation';
import { CargoCorretor, Corretor } from '../corretores/corretor.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { entidades, migracoes } from '../database/registros';
import { mensagemFalhaOperacional } from '../database/log-seguro';
import { Imovel, StatusImovel } from '../imoveis/imovel.entity';
import { CriarImovelDto } from '../imoveis/imoveis.dto';
import { ImoveisService } from '../imoveis/imoveis.service';
import { ImovelMidia, TipoMidia } from '../midias/imovel-midia.entity';
import { MidiasService } from '../midias/midias.service';
import { ArquivoMidia, validar_arquivo } from '../midias/validacao-arquivo';
import { catalogoCarga, caracteristicasCarga, ItemCatalogoCarga } from './seed-catalogo-dados';
import { conferirBackup, exigir, FalhaCarga, gravarPrivado, hash, objeto, validarDiretorio, validarDto } from './seed-catalogo-arquivos';
import { baixarFoto, conferirObjeto, objetosAusentes, validarUrlFoto } from './seed-catalogo-midias';
import { ARQUIVO_JOURNAL, carregarJournal, contaExistente, ItemPrivado, prepararConta } from './seed-catalogo-journal';
import { conferirGaleria, fingerprint, midiasBanco, montarDto, publicarFontesDaGaleria, referencias, snapshot } from './seed-catalogo-integridade';

const TRAVA = 741903;
type Opcoes = { executar: boolean; autor: number; diretorio?: string; backup?: string; whatsapp: string; conexaoDireta: boolean };
type Contagens = { previstos: number; novos: number; retomados: number; ignorados: number; fotos: number; cadastros_faltantes: number };

function argumentos(args: string[]): Opcoes {
  const modo = args.shift();
  exigir(modo === 'simular' || modo === 'executar', 'Use seed:catalogo:simular ou seed:catalogo:executar.');
  const opcoes: Opcoes = { executar: modo === 'executar', autor: 1, whatsapp: '5566984346427', conexaoDireta: false };
  const vistos = new Set<string>();
  while (args.length) {
    const chave = args.shift()!;
    exigir(!vistos.has(chave), 'Argumento repetido.'); vistos.add(chave);
    const valor = args.shift();
    exigir(valor && !valor.startsWith('--'), 'Argumento sem valor.');
    switch (chave) {
      case '--diretorio-privado': opcoes.diretorio = valor; break;
      case '--backup': opcoes.backup = valor; break;
      case '--autor-id': opcoes.autor = Number(valor); break;
      case '--whatsapp': opcoes.whatsapp = valor!; break;
      case '--conexao-direta': exigir(valor === 'true', '--conexao-direta aceita somente true.'); opcoes.conexaoDireta = true; break;
      default: throw new FalhaCarga('Argumento desconhecido. Não passe senhas, tokens ou conexão por argumentos.');
    }
  }
  exigir(Number.isSafeInteger(opcoes.autor) && opcoes.autor === 1, 'Autor deve ser o ADMIN ativo de id 1.');
  exigir(opcoes.whatsapp === '5566984346427', 'WhatsApp deve corresponder ao contato comercial confirmado.');
  exigir(!opcoes.executar || (opcoes.diretorio && opcoes.backup), 'Execução exige --diretorio-privado e --backup.');
  return opcoes;
}

function validarManifesto(): void {
  exigir(catalogoCarga.length === 12 && new Set(catalogoCarga.map(item => item.chave)).size === 12, 'Manifesto deve conter exatamente 12 chaves únicas.');
  for (const item of catalogoCarga) {
    exigir(/^[a-z0-9-]+$/.test(item.chave) && item.fotos.length === 3 && new Set(item.fotos.map(foto => foto.url)).size === 3, 'Cada item exige chave segura e três fotos distintas.');
    item.fotos.forEach(foto => { validarUrlFoto(foto.url); exigir(foto.pagina.startsWith('https://unsplash.com/') && foto.autor.trim(), 'Proveniência da foto incompleta.'); });
    exigir(item.dados.cidade === 'Juara' && item.dados.estado === 'MT' && Number(item.dados.area_util) > 0 && Number(item.dados.area_total) >= Number(item.dados.area_util), 'Área ou localização do manifesto inválida.');
    exigir(item.dados.status === undefined || item.dados.status === StatusImovel.DISPONIVEL, 'A carga cria apenas anúncios disponíveis.');
    exigir(item.caracteristicas.every(c => caracteristicasCarga.some(definicao => definicao.nome === c.nome)), 'Característica não definida no manifesto.');
    validarDto(CriarImovelDto, { ...item.dados, tipo_id: 1, finalidade_id: 1, corretor_id: 1, ativo: false,
      observacoes_internas: `carga:catalogo:2026-10-03:${item.chave}`, caracteristicas: item.caracteristicas.map((c, indice) => ({ caracteristica_id: indice + 1, valor: c.valor })) });
  }
}

async function arquivosDoItem(item: ItemCatalogoCarga, privado: ItemPrivado | undefined, diretorio: string): Promise<ArquivoMidia[]> {
  const arquivos: ArquivoMidia[] = [];
  for (const [indice, foto] of item.fotos.entries()) {
    const anterior = privado?.fotos[indice];
    let arquivo: ArquivoMidia;
    if (anterior) {
      const buffer = await readFile(join(diretorio, `${anterior.sha256}.imagem`));
      exigir(hash(buffer) === anterior.sha256 && buffer.length === anterior.tamanho, 'Cache privado de foto alterado ou incompleto.');
      arquivo = { buffer, size: buffer.length, mimetype: anterior.mimetype };
      exigir(validar_arquivo(arquivo).tipo === TipoMidia.IMAGEM, 'Cache privado inválido.');
    } else {
      arquivo = await baixarFoto(foto.url);
      await gravarPrivado(diretorio, `${hash(arquivo.buffer)}.imagem`, arquivo.buffer);
    }
    arquivos.push(arquivo);
  }
  exigir(arquivos.reduce((soma, arquivo) => soma + arquivo.size, 0) <= 60 * 1024 * 1024, 'Galeria ultrapassa 60 MB.');
  return arquivos;
}

export async function executarSeed(args = process.argv.slice(2)): Promise<Contagens> {
  const opcoes = argumentos([...args]); validarManifesto();
  let ambiente = validateEnvironment(process.env);
  let url = new URL(ambiente.DATABASE_URL);
  if (opcoes.conexaoDireta && url.hostname.includes('-pooler')) {
    url.hostname = url.hostname.replace(/-pooler(?=\.)/, '');
    ambiente = validateEnvironment({ ...process.env, DATABASE_URL: url.toString() });
    url = new URL(ambiente.DATABASE_URL);
  }
  exigir(!url.hostname.includes('-pooler'), 'A carga exige conexão Neon direta, sem pooler, para a trava de sessão.');
  const destino = { host: url.hostname, banco: decodeURIComponent(url.pathname.slice(1)) };
  const diretorio = opcoes.diretorio ? await validarDiretorio(opcoes.diretorio) : undefined;
  if (opcoes.executar) await conferirBackup(opcoes.backup!, destino);
  const journal = await carregarJournal(diretorio, destino);
  const salvar = () => gravarPrivado(diretorio!, ARQUIVO_JOURNAL, JSON.stringify(journal, null, 2));
  const banco = new DataSource({ ...createPostgresOptions(ambiente.DATABASE_URL), entities: entidades, migrations: migracoes, migrationsTableName: 'typeorm_migrations' });
  const contagens: Contagens = { previstos: 12, novos: 0, retomados: 0, ignorados: 0, fotos: 0, cadastros_faltantes: 0 };
  let s3: S3Client | undefined;
  await banco.initialize();
  const trava = banco.createQueryRunner();
  let bloqueado = false;
  try {
    await trava.connect();
    if (opcoes.executar) {
      const resultado: unknown = await trava.query('SELECT pg_try_advisory_lock($1) AS bloqueado', [TRAVA]);
      exigir(Array.isArray(resultado) && objeto(resultado[0]) && resultado[0].bloqueado === true, 'Outra carga está em execução.'); bloqueado = true;
    } else { await trava.startTransaction('REPEATABLE READ'); await trava.query('SET TRANSACTION READ ONLY'); }
    const manager = opcoes.executar ? banco.manager : trava.manager;
    const autor = await manager.getRepository(Corretor).findOneBy({ id: opcoes.autor, ativo: true, cargo: CargoCorretor.ADMIN });
    exigir(autor, 'Autor ADMIN ativo não encontrado.');
    const usuario: UsuarioAutenticado = autor!;
    const conta = await contaExistente(manager, journal);
    const ids = await referencias(manager, opcoes.executar, usuario, contagens);
    const corretor = opcoes.executar ? await prepararConta(manager, journal, diretorio!, salvar, usuario) : conta?.id ?? 1_000_001;
    if (opcoes.executar) {
      s3 = new S3Client({ region: 'auto', endpoint: ambiente.R2_ENDPOINT, credentials: { accessKeyId: ambiente.R2_ACCESS_KEY_ID, secretAccessKey: ambiente.R2_SECRET_ACCESS_KEY },
        requestHandler: { requestTimeout: ambiente.R2_REQUEST_TIMEOUT_MS, connectionTimeout: ambiente.R2_CONNECTION_TIMEOUT_MS } });
    }
    const imoveis = new ImoveisService(manager.getRepository(Imovel), manager.getRepository(ImovelMidia), manager.getRepository(ImovelCaracteristica));
    const urlBase = ambiente.R2_PUBLIC_URL.replace(/\/$/, '');
    for (const item of catalogoCarga) {
      let privado = journal.itens[item.chave];
      // Concluídos jamais são recriados/reativados, mesmo após edição ou remoção externa.
      // A URL pública pode ser reconciliada com a fonte licenciada sem tocar no anúncio nem no objeto privado.
      if (privado?.estado === 'concluido') {
        if (opcoes.executar && privado.id) {
          const existente = await manager.getRepository(Imovel).findOneBy({ id: privado.id });
          if (existente) await publicarFontesDaGaleria(manager, await midiasBanco(manager, existente.id), privado, existente.id, item.fotos.map(foto => foto.url), urlBase);
        }
        contagens.ignorados++; continue;
      }
      const dto = montarDto(item, ids, corretor);
      const anteriores = await manager.getRepository(Imovel).findBy({ observacoes_internas: dto.observacoes_internas! });
      exigir(anteriores.length <= 1, 'Marcador duplicado no banco; revisão necessária.');
      let imovel = anteriores[0];
      exigir(!imovel || privado, 'Marcador preexistente sem journal; alteração automática recusada.');
      if (!opcoes.executar) { if (imovel) contagens.retomados++; else contagens.novos++; continue; }
      if (privado) exigir(privado.manifesto === hash(JSON.stringify(item)) && privado.dto === hash(JSON.stringify(dto)), 'Manifesto ou referências mudaram desde a preparação.');
      const arquivos = await arquivosDoItem(item, privado, diretorio!);
      if (!privado) {
        privado = { manifesto: hash(JSON.stringify(item)), dto: hash(JSON.stringify(dto)), estado: 'preparado', fotos: arquivos.map(a => ({ sha256: hash(a.buffer), tamanho: a.size, mimetype: a.mimetype })) };
        journal.itens[item.chave] = privado; await salvar();
      }
      if (!imovel) {
        exigir(!privado.id && !privado.snapshot && !privado.fotos.some(f => f.chave), 'Anúncio da carga foi removido; recriação recusada.');
        const criado = await imoveis.criar(dto, usuario);
        imovel = await manager.getRepository(Imovel).findOneByOrFail({ id: criado.id }); contagens.novos++;
      } else contagens.retomados++;
      exigir(!privado.id || privado.id === imovel.id, 'Id do anúncio diverge do journal.');
      if (imovel.ativo && privado.estado === 'publicando') {
        const esperadoAtivo = validarDto(CriarImovelDto, { ...dto, ativo: true });
        exigir(await fingerprint(manager, imovel) === await fingerprint(manager, imovel, esperadoAtivo), 'Anúncio publicado foi alterado durante a retomada.');
        const midias = await midiasBanco(manager, imovel.id); conferirGaleria(midias, privado, imovel.id, item.fotos.map(foto => foto.url), urlBase);
        for (const foto of privado.fotos) await conferirObjeto(s3!, foto.chave!, foto.sha256, foto.tamanho);
        await publicarFontesDaGaleria(manager, midias, privado, imovel.id, item.fotos.map(foto => foto.url), urlBase);
        privado.estado = 'concluido'; privado.id = imovel.id; await salvar(); contagens.ignorados++; continue;
      }
      exigir(!imovel.ativo && await fingerprint(manager, imovel) === await fingerprint(manager, imovel, dto), 'Anúncio incompleto foi alterado; publicação automática recusada.');
      const atual = await snapshot(manager, imovel);
      exigir(!privado.snapshot || privado.snapshot === atual, 'Edição externa detectada no anúncio incompleto.');
      privado.id = imovel.id; privado.snapshot = atual; await salvar();
      let midias = await midiasBanco(manager, imovel.id);
      if (!midias.length) {
        const chaves = privado.fotos.flatMap(foto => foto.chave ? [foto.chave] : []);
        if (chaves.length) {
          exigir(await objetosAusentes(s3!, chaves), 'Upload interrompido sem registros de mídia: revisar objetos órfãos no R2 antes de retomar.');
          privado.fotos.forEach(foto => { delete foto.chave; }); await salvar();
        }
        let indiceUpload = 0;
        const middleware = 'registrarCargaAntesUpload';
        s3!.middlewareStack.add((proximo, contexto) => async parametros => {
          if (contexto.commandName === PutObjectCommand.name) {
            const entrada = parametros.input as { Key?: string; Body?: unknown };
            const foto = privado.fotos[indiceUpload++];
            exigir(foto && typeof entrada.Key === 'string' && Buffer.isBuffer(entrada.Body) && hash(entrada.Body) === foto.sha256, 'Upload fora do manifesto privado.');
            foto.chave = entrada.Key; await salvar();
          }
          return proximo(parametros);
        }, { step: 'initialize', name: middleware });
        try { await new MidiasService(manager.getRepository(ImovelMidia), s3!, new ConfigService(ambiente)).enviar(imovel.id, arquivos, usuario); }
        finally { s3!.middlewareStack.remove(middleware); }
        midias = await midiasBanco(manager, imovel.id);
      }
      conferirGaleria(midias, privado, imovel.id, item.fotos.map(foto => foto.url), urlBase);
      for (const foto of privado.fotos) await conferirObjeto(s3!, foto.chave!, foto.sha256, foto.tamanho);
      await publicarFontesDaGaleria(manager, midias, privado, imovel.id, item.fotos.map(foto => foto.url), urlBase);
      // Somente esta transação curta segura a linha; nenhum acesso ao R2 nela.
      await manager.transaction(async gerente => {
        const repositorio = gerente.getRepository(Imovel);
        const bloqueadoImovel = await repositorio.findOne({ where: { id: imovel.id }, lock: { mode: 'pessimistic_write' } });
        exigir(bloqueadoImovel && await snapshot(gerente, bloqueadoImovel) === privado.snapshot && !bloqueadoImovel.ativo, 'Edição concorrente detectada antes da publicação.');
        const dono = await gerente.getRepository(Corretor).findOne({ where: { id: corretor, ativo: true, cargo: CargoCorretor.ADMIN }, lock: { mode: 'pessimistic_read' } });
        exigir(dono, 'Responsável deixou de ser ADMIN ativo.');
        conferirGaleria(await midiasBanco(gerente, imovel.id), privado, imovel.id, item.fotos.map(foto => foto.url));
        privado.estado = 'publicando'; await salvar();
        await repositorio.save(Object.assign(bloqueadoImovel!, { ativo: true, alterado_por: usuario.id }));
      });
      privado.estado = 'concluido'; await salvar(); contagens.fotos += 3;
    }
    return contagens;
  } finally {
    try {
      if (trava.isTransactionActive) await trava.rollbackTransaction();
      if (bloqueado) await trava.query('SELECT pg_advisory_unlock($1)', [TRAVA]);
    } finally { await trava.release(); s3?.destroy(); await banco.destroy(); }
  }
}

if (require.main === module) {
  executarSeed().then(resultado => { console.log(JSON.stringify({ modo: process.argv[2], ...resultado })); }).catch((erro: unknown) => {
    console.error(erro instanceof FalhaCarga ? erro.message : mensagemFalhaOperacional(erro)); process.exitCode = 1;
  });
}
