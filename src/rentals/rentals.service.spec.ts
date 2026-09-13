import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RentalParty } from './rental-party.entity';
import { Lease } from './lease.entity';
import { Property } from '../properties/property.entity';
import { RentalPartiesService } from './rental-parties.service';
import { LeasesService } from './leases.service';
import { LeaseDto, PartyDto } from './rental.dto';

function repository<T extends object>(entries: T[] = []) {
  return {
    entries,
    create: (data: Partial<T>) => ({ ...data }),
    findOne: ({ where }: { where: Partial<T> }) => Promise.resolve(entries.find(item => Object.entries(where).every(([k,v]) => item[k as keyof T] === v)) ?? null),
    save: (data: T) => { entries.push(data); return Promise.resolve(data); },
    existsBy: (where: Partial<T>) => Promise.resolve(entries.some(item => Object.entries(where).every(([k,v]) => item[k as keyof T] === v))),
  };
}
const party = Object.assign(new PartyDto(), { kind: 'OWNER', personType: 'PF', name: 'Maria Silva', taxId: '52998224725' });
const input = Object.assign(new LeaseDto(), { reference: 'L-01', propertyId: 'property', ownerId: 'owner', tenantId: 'tenant', startDate: '2026-09-01', endDate: '2027-08-31', rentAmount: '1500.50', dueDay: 5, status: 'ACTIVE' });
describe('rental persistence rules', () => {
  const owners = repository<RentalParty>(); const leases = repository<Lease>(); const properties = repository<Property>();
  const manager = { getRepository: (type: unknown) => type === Lease ? leases : type === RentalParty ? owners : properties };
  const database = { transaction: async (callback: (m: typeof manager) => Promise<unknown>) => callback(manager) } as unknown as DataSource;
  const service = new LeasesService(leases as unknown as Repository<Lease>, database);
  const people = new RentalPartiesService(owners as unknown as Repository<RentalParty>, database);
  beforeEach(() => {
    owners.entries.length = leases.entries.length = properties.entries.length = 0;
    owners.entries.push(Object.assign(new RentalParty(), { id: 'owner', kind: 'OWNER', active: true, name: 'Maria', privateData: {} }), Object.assign(new RentalParty(), { id: 'tenant', kind: 'TENANT', active: true, name: 'José', privateData: {} }));
    properties.entries.push(Object.assign(new Property(), { id: 'property', title: 'Sala', purpose: 'LOCACAO' }));
  });
  it('stores personal details separately and returns the editable admin form', async () => {
    const created = await people.save(party);
    expect(created.taxId).toBe('52998224725');
    expect(owners.entries[2].privateData.taxId).toBe('52998224725');
    expect(created).not.toHaveProperty('privateData');
  });
  it('refuses to change an existing party kind', async () => {
    await expect(people.save({ ...party, kind: 'TENANT' }, 'owner')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('refuses to archive a party in an active lease', async () => {
    leases.entries.push(Object.assign(new Lease(), input));
    await expect(people.save({ ...party, active: false }, 'owner')).rejects.toBeInstanceOf(ConflictException);
  });
  it('creates linked leases with exact decimal amounts and safe response projections', async () => {
    const created = await service.save(input);
    expect(created).toMatchObject({ rentAmount: '1500.50', propertyTitle: 'Sala', ownerName: 'Maria', tenantName: 'José' });
    expect(created).not.toHaveProperty('owner');
  });
  it('rejects missing parties, mismatched roles and inactive people', async () => {
    await expect(service.save({ ...input, ownerId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.save({ ...input, ownerId: 'tenant' })).rejects.toBeInstanceOf(BadRequestException);
    owners.entries[0].active = false;
    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('allows ending an existing lease after its property becomes a sale listing', async () => {
    leases.entries.push(Object.assign(new Lease(), { ...input, id: 'existing' }));
    properties.entries[0].purpose = 'VENDA' as Property['purpose'];
    const ended = await service.save({ ...input, status: 'ENDED' }, 'existing');
    expect(ended.status).toBe('ENDED');
    await expect(service.save({ ...input, reference: 'NEW' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a second active lease for the same property', async () => {
    leases.entries.push(Object.assign(new Lease(), { ...input, id: 'existing' }));
    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });
});
