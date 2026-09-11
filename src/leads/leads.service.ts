import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, ILike, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AgentRole } from '../agents/agent.entity';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { Property, PropertyStatus } from '../properties/property.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { LeadResponse, toLeadResponse } from './dto/lead-response.dto';
import { Lead } from './lead.entity';

const TERMS_VERSION = 'v1.0';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Property) private readonly properties: Repository<Property>,
  ) {}

  async create(dto: CreateLeadDto, consentIp: string): Promise<LeadResponse> {
    if (dto.consentGiven !== true) throw new BadRequestException('O consentimento LGPD é obrigatório.');
    const property = await this.properties.findOne({
      where: { id: dto.propertyId, status: PropertyStatus.DISPONIVEL, agent: { active: true } },
      relations: { agent: true },
    });
    if (!property) throw new BadRequestException('Imóvel indisponível para receber leads.');
    const lead = this.leads.create({
      propertyId: property.id,
      property,
      agentId: property.agentId,
      agent: property.agent,
      leadName: dto.leadName,
      leadPhone: dto.leadPhone,
      leadEmail: dto.leadEmail ?? null,
      message: dto.message ?? null,
      consentGiven: true,
      consentTimestamp: new Date(),
      consentIp: consentIp || 'unknown',
      termsVersion: TERMS_VERSION,
    });
    return toLeadResponse(await this.leads.save(lead));
  }

  async list(query: LeadQueryDto, viewer: AgentProfile) {
    if (query.createdFrom && query.createdTo && new Date(query.createdFrom) > new Date(query.createdTo)) {
      throw new BadRequestException('createdFrom deve ser menor ou igual a createdTo.');
    }
    const base: FindOptionsWhere<Lead> = viewer.role === AgentRole.ADMIN ? {} : { agentId: viewer.id };
    if (query.propertyId) base.propertyId = query.propertyId;
    if (query.createdFrom && query.createdTo) {
      base.createdAt = Between(new Date(query.createdFrom), new Date(query.createdTo));
    } else if (query.createdFrom) {
      base.createdAt = MoreThanOrEqual(new Date(query.createdFrom));
    } else if (query.createdTo) {
      base.createdAt = LessThanOrEqual(new Date(query.createdTo));
    }
    const search = query.search ? this.escapeLike(query.search) : undefined;
    const where: FindOptionsWhere<Lead> | FindOptionsWhere<Lead>[] = search
      ? ['leadName', 'leadPhone', 'leadEmail'].map((field) => ({ ...base, [field]: ILike(`%${search}%`) }))
      : base;
    const [leads, total] = await this.leads.findAndCount({
      where,
      relations: { property: true, agent: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { items: leads.map(toLeadResponse), total, page: query.page, limit: query.limit,
      totalPages: Math.ceil(total / query.limit) };
  }

  async remove(id: string, viewer: AgentProfile): Promise<void> {
    const lead = await this.findOwned(id, viewer);
    await this.leads.remove(lead);
  }

  private async findOwned(id: string, viewer: AgentProfile): Promise<Lead> {
    const restriction: FindOptionsWhere<Lead> = viewer.role === AgentRole.ADMIN ? { id } : { id, agentId: viewer.id };
    const lead = await this.leads.findOne({ where: restriction, relations: { property: true, agent: true } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    return lead;
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}
