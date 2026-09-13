import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Property, PropertyPurpose } from '../properties/property.entity';
import { RentalParty } from './rental-party.entity';
import { Lease, leaseResponse } from './lease.entity';
import { LeaseDto, LeaseQuery } from './rental.dto';
import { validateLease } from './rental-rules';
@Injectable()
export class LeasesService {
  constructor(@InjectRepository(Lease) private readonly leases: Repository<Lease>, private readonly database: DataSource) {}
  async list(query: LeaseQuery) {
    const base: FindOptionsWhere<Lease> = {};
    if (query.status) base.status = query.status;
    const parties: FindOptionsWhere<Lease>[] = query.partyId ? [{ ownerId: query.partyId }, { tenantId: query.partyId }] : [{}];
    const search = ILike(`%${query.search.replace(/[\\%_]/g, '\\$&')}%`);
    const terms: FindOptionsWhere<Lease>[] = query.search ? [{ reference: search }, { property: { title: search } }, { owner: { name: search } }, { tenant: { name: search } }] : [{}];
    const where = parties.flatMap(party => terms.map(term => ({ ...base, ...party, ...term })));
    const [items, total] = await this.leases.findAndCount({ where, relations: { property: true, owner: true, tenant: true }, order: { createdAt: 'DESC', id: 'DESC' }, skip: (query.page - 1) * query.limit, take: query.limit });
    return { items: items.map(leaseResponse), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }
  async get(id: string) {
    const found = await this.leases.findOne({ where: { id }, relations: { property: true, owner: true, tenant: true } });
    if (!found) throw new NotFoundException('Contrato não encontrado.');
    return leaseResponse(found);
  }
  async save(dto: LeaseDto, id?: string) {
    validateLease(dto);
    try {
      return await this.database.transaction(async manager => {
        const leases = manager.getRepository(Lease);
        const current = id ? await leases.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } }) : undefined;
        if (id && !current) throw new NotFoundException('Contrato não encontrado.');
        const property = await manager.getRepository(Property).findOne({ where: { id: dto.propertyId }, lock: { mode: 'pessimistic_write' } });
        if (!property) throw new NotFoundException('Imóvel não encontrado.');
        if (property.purpose !== PropertyPurpose.LOCACAO && !(current?.propertyId === dto.propertyId && dto.status === 'ENDED')) throw new BadRequestException('Selecione um imóvel de locação.');
        const parties = manager.getRepository(RentalParty);
        const linked = new Map<string, RentalParty>();
        for (const partyId of [...new Set([dto.ownerId, dto.tenantId])].sort()) {
          const party = await parties.findOne({ where: { id: partyId }, lock: { mode: 'pessimistic_write' } });
          if (!party) throw new NotFoundException('Proprietário ou inquilino não encontrado.');
          linked.set(partyId, party);
        }
        const owner = linked.get(dto.ownerId)!; const tenant = linked.get(dto.tenantId)!;
        if (owner.kind !== 'OWNER' || tenant.kind !== 'TENANT') throw new BadRequestException('Os vínculos devem ser um proprietário e um inquilino.');
        if (dto.status !== 'ENDED' && (!owner.active || !tenant.active)) throw new BadRequestException('Selecione cadastros ativos.');
        if (dto.status === 'ACTIVE') {
          const existing = await leases.findOne({ where: { propertyId: dto.propertyId, status: 'ACTIVE' } });
          if (existing && existing.id !== id) throw new ConflictException('Este imóvel já possui um contrato ativo.');
        }
        const entity = leases.create({ ...current, ...dto, property, owner, tenant });
        return leaseResponse(await leases.save(entity));
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new ConflictException('Referência já cadastrada ou imóvel com contrato ativo.');
      throw error;
    }
  }
}
