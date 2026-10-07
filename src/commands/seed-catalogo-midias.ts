import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ArquivoMidia, TAMANHO_MAXIMO_IMAGEM, validar_arquivo } from '../midias/validacao-arquivo';
import { TipoMidia } from '../midias/imovel-midia.entity';
import { exigir, hash, objeto } from './seed-catalogo-arquivos';

export function validarUrlFoto(endereco: string): URL {
  const url = new URL(endereco);
  exigir(url.protocol === 'https:' && url.hostname === 'images.unsplash.com' && !url.username && !url.password && !url.port, 'Foto deve usar somente HTTPS no domínio images.unsplash.com.');
  return url;
}

export async function baixarFoto(endereco: string): Promise<ArquivoMidia> {
  const url = validarUrlFoto(endereco);
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), 30_000);
  try {
    const resposta = await fetch(url, { signal: controle.signal, redirect: 'error' });
    exigir(resposta.ok && resposta.body, 'Download de foto falhou.');
    exigir(Number(resposta.headers.get('content-length') ?? 0) <= TAMANHO_MAXIMO_IMAGEM, 'Foto excede o limite de 10 MB.');
    const leitor = resposta.body!.getReader();
    const partes: Buffer[] = [];
    let size = 0;
    try {
      while (true) {
        const trecho = await leitor.read();
        if (trecho.done) break;
        size += trecho.value.byteLength;
        if (size > TAMANHO_MAXIMO_IMAGEM) { controle.abort(); throw new Error('Limite de imagem'); }
        partes.push(Buffer.from(trecho.value));
      }
    } finally { leitor.releaseLock(); }
    const arquivo = { buffer: Buffer.concat(partes), size, mimetype: resposta.headers.get('content-type')?.split(';')[0] ?? '' };
    exigir(validar_arquivo(arquivo).tipo === TipoMidia.IMAGEM, 'Fonte deve conter uma imagem válida.');
    return arquivo;
  } finally { clearTimeout(temporizador); }
}

/** Confere os bytes reais do R2; ETag multipart não é um SHA-256. */
export async function conferirObjeto(s3: S3Client, chave: string, esperado: string, tamanho: number): Promise<void> {
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), 35_000);
  try {
    const resposta = await s3.send(new GetObjectCommand({ Bucket: 'corretor-midia', Key: chave }), { abortSignal: controle.signal });
    exigir(resposta.ContentLength === tamanho && tamanho <= TAMANHO_MAXIMO_IMAGEM && resposta.Body, 'Objeto R2 ausente ou divergente.');
    const partes: Buffer[] = [];
    let recebidos = 0;
    for await (const trecho of resposta.Body as unknown as AsyncIterable<Uint8Array>) {
      recebidos += trecho.byteLength;
      if (recebidos > tamanho || recebidos > TAMANHO_MAXIMO_IMAGEM) { controle.abort(); throw new Error('Limite de objeto'); }
      partes.push(Buffer.from(trecho));
    }
    exigir(recebidos === tamanho && hash(Buffer.concat(partes)) === esperado, 'Checksum da imagem no R2 diverge do manifesto privado.');
  } finally { clearTimeout(temporizador); }
}

/** Retentativa somente se a compensação anterior deixou todas as chaves ausentes. */
export async function objetosAusentes(s3: S3Client, chaves: string[]): Promise<boolean> {
  for (const chave of chaves) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: 'corretor-midia', Key: chave }), { abortSignal: AbortSignal.timeout(35_000) });
      return false;
    } catch (erro) {
      if (!(objeto(erro) && objeto(erro.$metadata) && erro.$metadata.httpStatusCode === 404)) throw erro;
    }
  }
  return true;
}
