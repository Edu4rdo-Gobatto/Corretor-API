import { CallHandler, ExecutionContext, Injectable, NestInterceptor, PayloadTooLargeException, HttpException, HttpStatus } from '@nestjs/common';
import { Readable } from 'node:stream';
import { defer, finalize, Observable } from 'rxjs';

export const TAMANHO_MAXIMO_LOTE = 60 * 1024 * 1024;
type ArquivoRecebido = { buffer: Buffer; size: number };

/** Contrato de storage do Multer; não acumula bytes que ultrapassam o lote. */
export class ArmazenamentoLimitado {
  private readonly totais = new WeakMap<object, number>();
  constructor(private readonly limite = TAMANHO_MAXIMO_LOTE) {}

  _handleFile(requisicao: object, arquivo: { stream: Readable }, concluir: (erro: Error | null, resultado?: ArquivoRecebido) => void): void {
    let chunks: Buffer[] = [];
    let tamanho = 0;
    let encerrado = false;
    const terminar = (erro: Error | null) => {
      if (encerrado) return;
      encerrado = true;
      arquivo.stream.removeListener('data', receber);
      const resultado = erro ? undefined : { buffer: Buffer.concat(chunks, tamanho), size: tamanho };
      chunks = [];
      concluir(erro, resultado);
      // Multer desmonta o parser e drena o corpo sem manter buffers após a falha.
      if (erro) arquivo.stream.resume();
    };
    const receber = (chunk: Buffer) => {
      const total = (this.totais.get(requisicao) ?? 0) + chunk.length;
      if (total > this.limite) { terminar(new PayloadTooLargeException('O lote de mídia deve ter no máximo 60 MB.')); return; }
      this.totais.set(requisicao, total);
      tamanho += chunk.length;
      chunks.push(chunk);
    };
    arquivo.stream.on('data', receber);
    arquivo.stream.once('error', terminar);
    arquivo.stream.once('end', () => terminar(null));
    arquivo.stream.once('close', () => { if (!encerrado) terminar(new Error('Upload interrompido.')); });
  }

  _removeFile(_requisicao: object, arquivo: Partial<ArquivoRecebido>, concluir: (erro: Error | null) => void): void {
    delete arquivo.buffer;
    concluir(null);
  }
}

/** Mantém a vaga até o fim do envio ao R2, inclusive enquanto há buffers pendentes. */
@Injectable()
export class RecepcaoMidiasInterceptor implements NestInterceptor {
  private emAndamento = 0;
  intercept(_contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    if (this.emAndamento >= 2) throw new HttpException('Há uploads em andamento. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    this.emAndamento++;
    return defer(() => proximo.handle()).pipe(finalize(() => { this.emAndamento--; }));
  }
}
