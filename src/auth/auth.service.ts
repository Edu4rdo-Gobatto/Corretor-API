import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AgentsService } from '../agents/agents.service';
import { toAgentProfile } from '../agents/dto/agent-profile.dto';
import { PasswordService } from '../common/security/password.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly agents: AgentsService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const agent = await this.agents.findForAuthentication(dto.email);
    if (!agent || !agent.active || !await this.passwords.verify(agent.passwordHash, dto.password)) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    return {
      accessToken: await this.jwt.signAsync({ sub: agent.id, role: agent.role }),
      tokenType: 'Bearer' as const,
      agent: toAgentProfile(agent),
    };
  }
}
