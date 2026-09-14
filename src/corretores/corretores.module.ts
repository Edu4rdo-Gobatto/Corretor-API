import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Corretor } from './corretor.entity';
import { CorretoresController } from './corretores.controller';
import { CorretoresService } from './corretores.service';
import { SenhasService } from './senhas.service';

@Module({ imports: [TypeOrmModule.forFeature([Corretor])], controllers: [CorretoresController], providers: [CorretoresService, SenhasService], exports: [CorretoresService, SenhasService, TypeOrmModule] })
export class CorretoresModule {}
