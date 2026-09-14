import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { ImovelCaracteristica } from '../cadastros/cadastros.entity';
import { ImovelMidia } from '../midias/imovel-midia.entity';
import { Imovel } from './imovel.entity';
import { ImoveisController, ImoveisPublicosController } from './imoveis.controller';
import { ImoveisService } from './imoveis.service';

@Module({ imports: [AutenticacaoModule, TypeOrmModule.forFeature([Imovel, ImovelMidia, ImovelCaracteristica])], controllers: [ImoveisController, ImoveisPublicosController], providers: [ImoveisService], exports: [ImoveisService] })
export class ImoveisModule {}
