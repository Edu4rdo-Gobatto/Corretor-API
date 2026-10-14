import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AvisosService } from './avisos.service';

@Module({ imports: [ConfigModule], providers: [AvisosService], exports: [AvisosService] })
export class AvisosModule {}
