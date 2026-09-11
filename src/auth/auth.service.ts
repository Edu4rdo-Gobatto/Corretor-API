import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AgentsService } from '../agents/agents.service';
import { toAgentProfile } from '../agents/dto/agent-profile.dto';
import { PasswordService } from '../common/security/password.service';
import { LoginDto } from './dto/login.dto';
import { SessionService } from './session.service';
import { Agent } from '../agents/agent.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly agents: AgentsService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {}

  async login(dto: LoginDto) {
    const agent = await this.agents.findForAuthentication(dto.email);
    if (!agent || !agent.active || !await this.passwords.verify(agent.passwordHash, dto.password)) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    return this.issueSession(agent);
  }

  async refresh(token: string) {
    const agent = await this.agents.findActiveById(await this.sessions.consume(token));
    if (!agent) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    return this.issueSession(agent);
  }

  logout(token: string) { return this.sessions.revoke(token); }

  private async issueSession(agent: Agent) {
    return {
      refreshToken: await this.sessions.create(agent.id),
      accessToken: await this.jwt.signAsync({ sub: agent.id, role: agent.role }),
      tokenType: 'Bearer' as const,
      agent: toAgentProfile(agent),
    };
  }
}
