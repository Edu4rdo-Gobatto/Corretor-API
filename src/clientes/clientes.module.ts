import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Cliente } from './cliente.entity';
import { ClientesController, ClientesPublicosController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { LimiteClientesGuard } from './limite-clientes.guard';

@Module({ imports: [AutenticacaoModule, TypeOrmModule.forFeature([Cliente, Corretor, Imovel])],
  controllers: [ClientesController, ClientesPublicosController], providers: [ClientesService, LimiteClientesGuard], exports: [ClientesService, TypeOrmModule] })
export class ClientesModule {}
