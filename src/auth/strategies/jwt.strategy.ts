import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isUUID } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AgentsService } from '../../agents/agents.service';
import { AgentProfile, toAgentProfile } from '../../agents/dto/agent-profile.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configuration: ConfigService, private readonly agents: AgentsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configuration.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      issuer: 'corretor-api',
      audience: 'corretor-web',
      ignoreExpiration: false,
    });
  }

  async validate(payload: unknown): Promise<AgentProfile> {
    if (typeof payload !== 'object' || payload === null || !('sub' in payload)
      || typeof payload.sub !== 'string' || !isUUID(payload.sub, '4')
      || !('exp' in payload) || typeof payload.exp !== 'number') {
      throw new UnauthorizedException();
    }
    const agent = await this.agents.findActiveById(payload.sub);
    if (!agent) throw new UnauthorizedException();
    // Authorization uses the current role, so deactivation/demotion takes effect immediately.
    return toAgentProfile(agent);
  }
}
