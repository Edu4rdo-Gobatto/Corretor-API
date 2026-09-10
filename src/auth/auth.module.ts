import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AgentsModule } from '../agents/agents.module';
import { PasswordModule } from '../common/security/password.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    AgentsModule,
    PasswordModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configuration: ConfigService) => ({
        secret: configuration.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configuration.getOrThrow<JwtSignOptions['expiresIn']>('JWT_EXPIRES_IN'),
          algorithm: 'HS256',
          issuer: 'corretor-api',
          audience: 'corretor-web',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
