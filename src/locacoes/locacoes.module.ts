import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { DriveModule } from '../drive/drive.module';
import { Contrato } from './contrato.entity';
import { ParteLocacao } from './parte-locacao.entity';
import { ContratosController, PartesLocacaoController } from './locacoes.controller';
import { LocacoesService } from './locacoes.service';

@Module({ imports: [AutenticacaoModule, DriveModule, TypeOrmModule.forFeature([Contrato, ParteLocacao])], providers: [LocacoesService], controllers: [ContratosController, PartesLocacaoController], exports: [LocacoesService] })
export class LocacoesModule {}
