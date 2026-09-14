import { BadRequestException } from '@nestjs/common';
import { validar_arquivo } from './validacao-arquivo';

describe('Validação da assinatura de mídia', () => {
  it('aceita JPEG e rejeita conteúdo incompatível com MIME', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(validar_arquivo({ buffer, size: buffer.length, mimetype: 'image/jpeg' })).toEqual({ tipo: 'IMAGEM', extensao: '.jpg' });
    expect(() => validar_arquivo({ buffer: Buffer.from('<script>'), size: 8, mimetype: 'image/jpeg' })).toThrow(BadRequestException);
  });

  it('rejeita tamanho declarado inconsistente, vazio e além do limite', () => {
    expect(() => validar_arquivo({ buffer: Buffer.alloc(0), size: 0, mimetype: 'image/png' })).toThrow();
    expect(() => validar_arquivo({ buffer: Buffer.alloc(4), size: 30, mimetype: 'video/mp4' })).toThrow();
    const buffer = Buffer.alloc(10 * 1024 * 1024 + 1);
    expect(() => validar_arquivo({ buffer, size: buffer.length, mimetype: 'image/jpeg' })).toThrow();
  });

  it('aceita assinatura MP4 e recusa AVI disfarçado de WebP', () => {
    const buffer = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    expect(validar_arquivo({ buffer, size: buffer.length, mimetype: 'video/mp4' }).tipo).toBe('VIDEO_ARQUIVO');
    const avi = Buffer.from('RIFFxxxxAVI ');
    expect(() => validar_arquivo({ buffer: avi, size: avi.length, mimetype: 'image/webp' })).toThrow();
  });

  it('não confunde imagens HEIC/AVIF com vídeo MP4 por compartilharem ftyp', () => {
    const heic = Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic')]);
    expect(() => validar_arquivo({ buffer: heic, size: heic.length, mimetype: 'video/mp4' })).toThrow();
  });
});
