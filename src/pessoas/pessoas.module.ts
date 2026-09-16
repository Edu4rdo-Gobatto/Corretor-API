import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { Pessoa } from './pessoa.entity';
import { PessoasController, PessoasPublicasController } from './pessoas.controller';
import { PessoasService } from './pessoas.service';
import { LimitePessoasGuard } from './limite-pessoas.guard';

@Module({
  imports: [AutenticacaoModule, TypeOrmModule.forFeature([Pessoa, Corretor, Imovel, Contrato])],
  controllers: [PessoasController, PessoasPublicasController], providers: [PessoasService, LimitePessoasGuard], exports: [PessoasService, TypeOrmModule],
})
export class PessoasModule {}
