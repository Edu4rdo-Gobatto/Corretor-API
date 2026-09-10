import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PasswordService } from '../common/security/password.service';
import { Agent, AgentRole } from './agent.entity';
import { AgentProfile, toAgentProfile } from './dto/agent-profile.dto';
import { CreateAgentDto } from './dto/create-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    private readonly passwords: PasswordService,
  ) {}

  findForAuthentication(email: string): Promise<Agent | null> {
    return this.agents.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'passwordHash', 'whatsappNumber', 'creci', 'role', 'avatarUrl', 'active', 'createdAt'],
    });
  }

  findActiveById(id: string): Promise<Agent | null> {
    return this.agents.findOneBy({ id, active: true });
  }

  async create(dto: CreateAgentDto): Promise<AgentProfile> {
    if (await this.agents.existsBy({ email: dto.email })) {
      throw new ConflictException('Já existe um corretor com esse e-mail.');
    }
    const agent = this.agents.create({
      name: dto.name,
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      whatsappNumber: dto.whatsappNumber,
      creci: dto.creci ?? null,
      role: dto.role,
      avatarUrl: dto.avatarUrl ?? null,
      active: true,
    });
    try {
      return toAgentProfile(await this.agents.save(agent));
    } catch (error) {
      // The database unique constraint also handles concurrent requests.
      if (error instanceof QueryFailedError) {
        const cause: unknown = error.driverError;
        if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
          throw new ConflictException('Já existe um corretor com esse e-mail.');
        }
      }
      throw error;
    }
  }

  async createInitialAdministrator(dto: CreateAgentDto): Promise<AgentProfile> {
    if (await this.agents.existsBy({ role: AgentRole.ADMIN })) {
      throw new ConflictException('Já existe um administrador. Use o cadastro autenticado.');
    }
    return this.create({ ...dto, role: AgentRole.ADMIN });
  }
}
