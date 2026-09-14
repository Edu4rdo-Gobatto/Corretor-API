import { BadRequestException } from '@nestjs/common';
import { TipoMidia } from './imovel-midia.entity';

export type ArquivoMidia = { buffer: Buffer; mimetype: string; size: number };
export const TAMANHO_MAXIMO_IMAGEM = 10 * 1024 * 1024;
export const TAMANHO_MAXIMO_VIDEO = 30 * 1024 * 1024;

export function validar_arquivo(arquivo: ArquivoMidia): { tipo: TipoMidia; extensao: string } {
  const { buffer, size, mimetype } = arquivo;
  if (!Buffer.isBuffer(buffer) || !size || size !== buffer.length) throw new BadRequestException('Arquivo vazio ou tamanho inconsistente.');
  const tipos: Record<string, { extensao: string; assinatura: () => boolean; imagem: boolean }> = {
    'image/jpeg': { extensao: '.jpg', imagem: true, assinatura: () => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
    'image/png': { extensao: '.png', imagem: true, assinatura: () => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    'image/webp': { extensao: '.webp', imagem: true, assinatura: () => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
    'video/mp4': { extensao: '.mp4', imagem: false, assinatura: () => buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(buffer.toString('ascii', 8, 12)) },
    'video/webm': { extensao: '.webm', imagem: false, assinatura: () => buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && buffer.subarray(0, 4096).includes(Buffer.from('webm')) },
  };
  const tipo = tipos[mimetype];
  if (!tipo || !tipo.assinatura()) throw new BadRequestException('Tipo ou assinatura de mídia inválido. Use JPEG, PNG, WebP, MP4 ou WebM.');
  if (size > (tipo.imagem ? TAMANHO_MAXIMO_IMAGEM : TAMANHO_MAXIMO_VIDEO)) throw new BadRequestException(tipo.imagem ? 'Cada imagem deve ter no máximo 10 MB.' : 'Cada vídeo deve ter no máximo 30 MB.');
  return { tipo: tipo.imagem ? TipoMidia.IMAGEM : TipoMidia.VIDEO_ARQUIVO, extensao: tipo.extensao };
}
