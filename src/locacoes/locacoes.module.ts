import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { DriveModule } from '../drive/drive.module';
import { Contrato } from './contrato.entity';
import { ContratosController } from './locacoes.controller';
import { LocacoesService } from './locacoes.service';

@Module({ imports: [AutenticacaoModule, DriveModule, TypeOrmModule.forFeature([Contrato])], providers: [LocacoesService], controllers: [ContratosController], exports: [LocacoesService] })
export class LocacoesModule {}
