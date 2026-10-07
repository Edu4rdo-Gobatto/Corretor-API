import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { R2_MIDIAS } from '../comum/armazenamento.module';
import { ArquivoMidia, validar_arquivo } from '../midias/validacao-arquivo';
import { TipoMidia } from '../midias/imovel-midia.entity';

const BUCKET = 'corretor-midia';

@Injectable()
export class FotosCorretorService {
  private readonly logger = new Logger(FotosCorretorService.name);
  constructor(@Inject(R2_MIDIAS) private readonly armazenamento: S3Client, private readonly configuracao: ConfigService) {}

  private get base() { return this.configuracao.getOrThrow<string>('R2_PUBLIC_URL').replace(/\/$/, ''); }

  chave(url: string | null | undefined, id: number): string | null {
    const prefixo = `${this.base}/corretores/${id}/`;
    if (!url?.startsWith(prefixo)) return null;
    const arquivo = url.slice(prefixo.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(arquivo)) return null;
    return `corretores/${id}/${arquivo}`;
  }

  async enviar(id: number, foto: ArquivoMidia): Promise<string> {
    const validado = validar_arquivo(foto);
    if (validado.tipo !== TipoMidia.IMAGEM) throw new BadRequestException('Use uma foto JPG, PNG ou WebP.');
    const chave = `corretores/${id}/${randomUUID()}${validado.extensao}`;
    const url = `${this.base}/${chave}`;
    try {
      await this.armazenamento.send(new PutObjectCommand({ Bucket: BUCKET, Key: chave, Body: foto.buffer, ContentType: foto.mimetype }));
      return url;
    } catch (erro) { await this.excluir(url, id); throw erro; }
  }

  async excluir(url: string | null | undefined, id: number): Promise<void> {
    const chave = this.chave(url, id);
    if (!chave) return;
    try { await this.armazenamento.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chave })); }
    catch { this.logger.error(`Falha na limpeza da foto do corretor ${id}; verificar objetos órfãos no R2.`); }
  }

  async ler(url: string, id: number) {
    const chave = this.chave(url, id);
    if (!chave) return null;
    return this.armazenamento.send(new GetObjectCommand({ Bucket: BUCKET, Key: chave }));
  }
}
