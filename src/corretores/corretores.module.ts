import { Module } from '@nestjs/common';
import { ArmazenamentoModule } from '../comum/armazenamento.module';
import { FotosCorretorService } from './fotos-corretor.service';
import { FotoCorretorController } from './foto-corretor.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Corretor } from './corretor.entity';
import { CorretoresController } from './corretores.controller';
import { CorretoresService } from './corretores.service';
import { SenhasService } from './senhas.service';

@Module({ imports: [ArmazenamentoModule, TypeOrmModule.forFeature([Corretor])], controllers: [CorretoresController, FotoCorretorController], providers: [FotosCorretorService, CorretoresService, SenhasService], exports: [CorretoresService, SenhasService, TypeOrmModule] })
export class CorretoresModule {}
