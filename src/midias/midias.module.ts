import { Module } from '@nestjs/common';
import { ArmazenamentoModule } from '../comum/armazenamento.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { Imovel } from '../imoveis/imovel.entity';
import { ImovelMidia } from './imovel-midia.entity';
import { MidiasController } from './midias.controller';
import { MidiasService } from './midias.service';
import { PodeEditarImovelGuard } from './pode-editar-imovel.guard';

@Module({
  imports: [ArmazenamentoModule, AutenticacaoModule, TypeOrmModule.forFeature([Imovel, ImovelMidia])], controllers: [MidiasController],
  providers: [MidiasService, PodeEditarImovelGuard], exports: [MidiasService],
})
export class MidiasModule {}
