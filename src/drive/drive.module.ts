import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriveCliente } from './drive-cliente';
import { DriveService } from './drive.service';
import { RegistroPastaDrive } from './registro-pasta-drive.entity';

@Module({ imports: [ConfigModule, TypeOrmModule.forFeature([RegistroPastaDrive])], providers: [DriveCliente, DriveService], exports: [DriveService] })
export class DriveModule {}
