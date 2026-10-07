import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { RecepcaoMidiasInterceptor } from '../midias/recepcao-midias';

export const R2_MIDIAS = 'R2_MIDIAS';

/** Storage e quota de recepção únicos, compartilhados por imóveis e fotos pessoais. */
@Module({ providers: [RecepcaoMidiasInterceptor, {
  provide: R2_MIDIAS, inject: [ConfigService], useFactory: (configuracao: ConfigService) => new S3Client({
    region: 'auto', endpoint: configuracao.getOrThrow<string>('R2_ENDPOINT'),
    credentials: { accessKeyId: configuracao.getOrThrow<string>('R2_ACCESS_KEY_ID'), secretAccessKey: configuracao.getOrThrow<string>('R2_SECRET_ACCESS_KEY') },
    requestHandler: { requestTimeout: configuracao.getOrThrow<number>('R2_REQUEST_TIMEOUT_MS'), connectionTimeout: configuracao.getOrThrow<number>('R2_CONNECTION_TIMEOUT_MS') },
  }),
}], exports: [R2_MIDIAS, RecepcaoMidiasInterceptor] })
export class ArmazenamentoModule {}
