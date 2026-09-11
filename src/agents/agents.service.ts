import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PasswordService } from '../common/security/password.service';
import { Agent, AgentRole } from './agent.entity';
import { AgentProfile, toAgentProfile } from './dto/agent-profile.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';

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

  async list(query: AgentQueryDto) {
    const [agents, total] = await this.agents.findAndCount({ order: { name: 'ASC', id: 'ASC' }, skip: (query.page - 1) * query.limit, take: query.limit });
    return { items: agents.map(toAgentProfile), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentProfile> {
    const passwordHash = dto.password === undefined ? undefined : await this.passwords.hash(dto.password);
    try {
      return await this.agents.manager.transaction(async manager => {
        // Serialize account edits before reading the administrator count, including concurrent demotions.
        await manager.query('SELECT pg_advisory_xact_lock(741901)');
        const repository = manager.getRepository(Agent);
        const agent = await repository.findOneBy({ id });
        if (!agent) throw new NotFoundException('Corretor não encontrado.');
        const removesAdministrator = agent.active && agent.role === AgentRole.ADMIN
          && (dto.active === false || (dto.role !== undefined && dto.role !== AgentRole.ADMIN));
        if (removesAdministrator && await repository.countBy({ active: true, role: AgentRole.ADMIN }) <= 1) {
          throw new ConflictException('Não é possível desativar ou rebaixar o último administrador ativo.');
        }
        const changes = Object.fromEntries(Object.entries(dto).filter(([key, value]) => key !== 'password' && value !== undefined));
        Object.assign(agent, changes, passwordHash ? { passwordHash } : {});
        return toAgentProfile(await repository.save(agent));
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('Já existe um corretor com esse e-mail.');
      }
      throw error;
    }
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
