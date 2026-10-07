import { Module } from '@nestjs/common';
import { ArmazenamentoModule } from '../comum/armazenamento.module';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorretoresModule } from '../corretores/corretores.module';
import { AtividadeSessaoInterceptor } from './atividade-sessao.interceptor';
import { AutenticacaoController } from './autenticacao.controller';
import { AutenticacaoGuard } from './autenticacao.guard';
import { AutenticacaoService } from './autenticacao.service';
import { CargosGuard } from './cargos.guard';
import { EstrategiaJwt } from './estrategia-jwt';
import { OrigemGuard } from './origem.guard';
import { SessaoLogin } from './sessao-login.entity';
import { SessoesService } from './sessoes.service';
import { TentativasGuard } from './tentativas.guard';

@Module({
  imports: [ArmazenamentoModule, CorretoresModule, TypeOrmModule.forFeature([SessaoLogin]), PassportModule,
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: (configuracao: ConfigService) => ({
      secret: configuracao.getOrThrow<string>('JWT_SECRET'), signOptions: {
        expiresIn: configuracao.getOrThrow<JwtSignOptions['expiresIn']>('JWT_EXPIRES_IN'), algorithm: 'HS256', issuer: 'corretor-api', audience: 'corretor-web',
      },
    }) }),
  ],
  controllers: [AutenticacaoController],
  providers: [AutenticacaoService, SessoesService, EstrategiaJwt, AutenticacaoGuard, CargosGuard, OrigemGuard, TentativasGuard,
    { provide: APP_INTERCEPTOR, useClass: AtividadeSessaoInterceptor }],
  exports: [AutenticacaoGuard, CargosGuard],
})
export class AutenticacaoModule {}
