import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { IndicesReajusteController, OpcoesContratoController, TiposContratoController } from './cadastros-contrato.controller';
import { IndiceReajuste, TipoContrato } from './cadastros-contrato.entity';
import { CadastrosContratoService } from './cadastros-contrato.service';

@Module({ imports: [AutenticacaoModule, TypeOrmModule.forFeature([IndiceReajuste, TipoContrato])], controllers: [OpcoesContratoController, IndicesReajusteController, TiposContratoController], providers: [CadastrosContratoService] })
export class CadastrosContratoModule {}
