import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { Caracteristica, Cidade, FinalidadeImovel, ImovelCaracteristica, TipoImovel } from './cadastros.entity';
import { controladoresCadastros } from './cadastros.controller';
import { CadastrosService } from './cadastros.service';

@Module({ imports: [AutenticacaoModule, TypeOrmModule.forFeature([TipoImovel, FinalidadeImovel, Caracteristica, ImovelCaracteristica, Cidade])], controllers: controladoresCadastros, providers: [CadastrosService], exports: [CadastrosService] })
export class CadastrosModule {}
