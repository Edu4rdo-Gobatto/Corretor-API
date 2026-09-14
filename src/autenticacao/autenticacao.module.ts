import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorretoresModule } from '../corretores/corretores.module';
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
  imports: [CorretoresModule, TypeOrmModule.forFeature([SessaoLogin]), PassportModule,
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: (configuracao: ConfigService) => ({
      secret: configuracao.getOrThrow<string>('JWT_SECRET'), signOptions: {
        expiresIn: configuracao.getOrThrow<JwtSignOptions['expiresIn']>('JWT_EXPIRES_IN'), algorithm: 'HS256', issuer: 'corretor-api', audience: 'corretor-web',
      },
    }) }),
  ],
  controllers: [AutenticacaoController],
  providers: [AutenticacaoService, SessoesService, EstrategiaJwt, AutenticacaoGuard, CargosGuard, OrigemGuard, TentativasGuard],
  exports: [AutenticacaoGuard, CargosGuard],
})
export class AutenticacaoModule {}
