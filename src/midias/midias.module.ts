import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Client } from '@aws-sdk/client-s3';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { Imovel } from '../imoveis/imovel.entity';
import { ImovelMidia } from './imovel-midia.entity';
import { MidiasController } from './midias.controller';
import { MidiasService, R2_MIDIAS } from './midias.service';

@Module({
  imports: [AutenticacaoModule, TypeOrmModule.forFeature([Imovel, ImovelMidia])], controllers: [MidiasController],
  providers: [MidiasService, { provide: R2_MIDIAS, inject: [ConfigService], useFactory: (configuracao: ConfigService) => new S3Client({
    region: 'auto', endpoint: configuracao.getOrThrow<string>('R2_ENDPOINT'),
    credentials: { accessKeyId: configuracao.getOrThrow<string>('R2_ACCESS_KEY_ID'), secretAccessKey: configuracao.getOrThrow<string>('R2_SECRET_ACCESS_KEY') },
    requestHandler: { requestTimeout: configuracao.getOrThrow<number>('R2_REQUEST_TIMEOUT_MS'), connectionTimeout: configuracao.getOrThrow<number>('R2_CONNECTION_TIMEOUT_MS') },
  }) }], exports: [MidiasService],
})
export class MidiasModule {}
