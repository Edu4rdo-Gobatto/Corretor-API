import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { Comissao } from './comissao.entity';
import { ParcelaComissao } from './parcela-comissao.entity';
import { ComissoesController } from './comissoes.controller';
import { ComissoesService } from './comissoes.service';

@Module({ imports: [AutenticacaoModule, TypeOrmModule.forFeature([Comissao, ParcelaComissao])], controllers: [ComissoesController], providers: [ComissoesService], exports: [ComissoesService] })
export class ComissoesModule {}
