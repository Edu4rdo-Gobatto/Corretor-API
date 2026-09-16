import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacaoModule } from './autenticacao/autenticacao.module';
import { CorretoresModule } from './corretores/corretores.module';
import { CadastrosModule } from './cadastros/cadastros.module';
import { ImoveisModule } from './imoveis/imoveis.module';
import { MidiasModule } from './midias/midias.module';
import { PessoasModule } from './pessoas/pessoas.module';
import { LocacoesModule } from './locacoes/locacoes.module';
import { ComissoesModule } from './comissoes/comissoes.module';
import { SaudeModule } from './saude/saude.module';
import { createDatabaseOptions } from './config/database.config';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: createDatabaseOptions }),
    ScheduleModule.forRoot(), AutenticacaoModule, CorretoresModule, CadastrosModule,
    ImoveisModule, MidiasModule, PessoasModule, LocacoesModule, ComissoesModule, SaudeModule,
  ],
})
export class AppModule {}
