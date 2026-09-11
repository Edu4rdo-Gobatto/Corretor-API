import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Between, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { AgentRole } from '../agents/agent.entity';
import { AgentsService } from '../agents/agents.service';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { toPropertyResponse } from './dto/property-response.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property, PropertyStatus } from './property.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property) private readonly properties: Repository<Property>,
    private readonly agents: AgentsService,
  ) {}

  listPublic(query: PropertyQueryDto) {
    return this.list(query, { status: PropertyStatus.DISPONIVEL, agent: { active: true } });
  }

  listManaged(query: PropertyQueryDto, viewer: AgentProfile) {
    return this.list(query, this.ownerRestriction(viewer));
  }

  async findPublic(slug: string) {
    const property = await this.properties.findOne({
      where: { slug, status: PropertyStatus.DISPONIVEL, agent: { active: true } }, relations: { agent: true, media: true },
    });
    if (!property) throw new NotFoundException('Imóvel não encontrado.');
    return toPropertyResponse(property);
  }

  async findManaged(id: string, viewer: AgentProfile) {
    return toPropertyResponse(await this.findOwned(id, viewer));
  }

  async create(dto: CreatePropertyDto, viewer: AgentProfile) {
    this.validateAreas(dto.usableArea, dto.totalArea);
    const agent = await this.resolveOwner(dto.agentId ?? viewer.id, viewer);
    const id = randomUUID();
    const titleSlug = dto.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'imovel';
    const property = this.properties.create({
      ...dto, id, slug: `${titleSlug}-${id}`, agentId: agent.id, agent,
      features: dto.features ?? {}, status: dto.status ?? PropertyStatus.DISPONIVEL,
      condoFee: dto.condoFee ?? null, iptuFee: dto.iptuFee ?? null,
    });
    return toPropertyResponse(await this.properties.save(property));
  }

  async update(id: string, dto: UpdatePropertyDto, viewer: AgentProfile) {
    const property = await this.findOwned(id, viewer);
    this.validateAreas(dto.usableArea ?? property.usableArea, dto.totalArea ?? property.totalArea);
    const agent = dto.agentId === undefined ? property.agent : await this.resolveOwner(dto.agentId, viewer);
    // Class DTOs contain undefined fields; only explicitly supplied values may overwrite state.
    const changes = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    Object.assign(property, changes, { agent, agentId: agent.id });
    return toPropertyResponse(await this.properties.save(property));
  }

  async remove(id: string, viewer: AgentProfile): Promise<void> {
    const property = await this.findOwned(id, viewer);
    await this.properties.remove(property);
  }

  private async list(query: PropertyQueryDto, restriction: FindOptionsWhere<Property>) {
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
      throw new BadRequestException('minPrice deve ser menor ou igual a maxPrice.');
    }
    const where: FindOptionsWhere<Property> = { ...restriction };
    if (query.type) where.type = query.type;
    if (query.purpose) where.purpose = query.purpose;
    if (query.city) where.addressCity = ILike(query.city.trim().replace(/[\\%_]/g, '\\$&'));
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = Between(query.minPrice ?? 0, query.maxPrice ?? 9999999999.99);
    }
    const [properties, total] = await this.properties.findAndCount({
      where, relations: { agent: true }, order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit, take: query.limit,
    });
    return { items: properties.map(toPropertyResponse), total, page: query.page, limit: query.limit,
      totalPages: Math.ceil(total / query.limit) };
  }

  private async findOwned(id: string, viewer: AgentProfile): Promise<Property> {
    const property = await this.properties.findOne({ where: { id, ...this.ownerRestriction(viewer) }, relations: { agent: true, media: true } });
    if (!property) throw new NotFoundException('Imóvel não encontrado.');
    return property;
  }

  private ownerRestriction(viewer: AgentProfile): FindOptionsWhere<Property> {
    return viewer.role === AgentRole.ADMIN ? {} : { agentId: viewer.id };
  }

  private async resolveOwner(agentId: string, viewer: AgentProfile) {
    if (viewer.role !== AgentRole.ADMIN && agentId !== viewer.id) {
      throw new ForbiddenException('Somente ADMIN pode atribuir imóveis a outro corretor.');
    }
    const agent = await this.agents.findActiveById(agentId);
    if (!agent) throw new NotFoundException('Corretor ativo não encontrado.');
    return agent;
  }

  private validateAreas(usableArea: number, totalArea: number): void {
    if (usableArea > totalArea) throw new BadRequestException('Área útil não pode superar a área total.');
  }
}
