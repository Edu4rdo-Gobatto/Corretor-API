import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PartyDto, PartyQuery } from './rental.dto';
import { RentalParty, partyResponse } from './rental-party.entity';
import { Lease } from './lease.entity';
import { validateParty } from './rental-rules';
@Injectable()
export class RentalPartiesService {
  constructor(@InjectRepository(RentalParty) private readonly parties: Repository<RentalParty>, private readonly database: DataSource) {}
  async list(query: PartyQuery) {
    const where: FindOptionsWhere<RentalParty> = {};
    if (query.kind) where.kind = query.kind;
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.search) where.name = ILike(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`);
    const [items, total] = await this.parties.findAndCount({ where, order: { name: 'ASC', id: 'ASC' }, skip: (query.page - 1) * query.limit, take: query.limit });
    return { items: items.map(partyResponse), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }
  async get(id: string) {
    const found = await this.parties.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Cadastro não encontrado.');
    return partyResponse(found);
  }
  async save(dto: PartyDto, id?: string) {
    validateParty(dto);
    return this.database.transaction(async manager => {
      const repository = manager.getRepository(RentalParty);
      const current = id ? await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } }) : undefined;
      if (id && !current) throw new NotFoundException('Cadastro não encontrado.');
      if (current && current.kind !== dto.kind) throw new BadRequestException('O tipo de cadastro não pode ser alterado.');
      if (id && !dto.active) {
        const leases = manager.getRepository(Lease);
        const linked = await leases.existsBy({ status: 'ACTIVE', ...(dto.kind === 'OWNER' ? { ownerId: id } : { tenantId: id }) });
        if (linked) throw new ConflictException('Encerre os contratos ativos antes de desativar este cadastro.');
      }
      const { kind, personType, name, active, ...privateData } = dto;
      const entity = repository.create({ ...current, kind, personType, name, active, privateData });
      return partyResponse(await repository.save(entity));
    });
  }
}
