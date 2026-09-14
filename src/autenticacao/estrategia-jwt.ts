import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isUUID } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { CorretoresService } from '../corretores/corretores.service';

@Injectable()
export class EstrategiaJwt extends PassportStrategy(Strategy, 'autenticacao-jwt') {
  constructor(configuracao: ConfigService, private readonly corretores: CorretoresService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: configuracao.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'], issuer: 'corretor-api', audience: 'corretor-web', ignoreExpiration: false });
  }
  async validate(payload: unknown): Promise<UsuarioAutenticado> {
    if (typeof payload !== 'object' || payload === null || !('sub' in payload) || typeof payload.sub !== 'string' || !isUUID(payload.sub, '4')
      || !('exp' in payload) || typeof payload.exp !== 'number') throw new UnauthorizedException('Sessão inválida.');
    const corretor = await this.corretores.buscarAtivoPorId(payload.sub);
    if (!corretor) throw new UnauthorizedException('Sessão inválida.');
    // Cargo é lido no banco a cada requisição; o payload antigo não preserva privilégios.
    return { id: corretor.id, nome: corretor.nome, email: corretor.email, cargo: corretor.cargo };
  }
}
