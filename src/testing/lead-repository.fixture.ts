import { randomUUID } from 'node:crypto';
import { DeepPartial, FindManyOptions, FindOneOptions, FindOperator, FindOptionsWhere } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { Lead } from '../leads/lead.entity';
import { AgentRepositoryFixture } from './agent-repository.fixture';
import { PropertyRepositoryFixture } from './property-repository.fixture';

export class LeadRepositoryFixture {
  readonly leads = new Map<string, Lead>();

  constructor(private readonly agents: AgentRepositoryFixture, private readonly properties: PropertyRepositoryFixture) {}

  create(fields: DeepPartial<Lead>): Lead {
    return Object.assign(new Lead(), {
      id: randomUUID(), propertyId: null, leadEmail: null, message: null, consentGiven: true,
      consentTimestamp: new Date(), consentIp: '127.0.0.1', termsVersion: 'v1.0', createdAt: new Date(),
    }, fields);
  }

  save(lead: Lead): Promise<Lead> {
    lead.property = lead.propertyId ? this.properties.properties.get(lead.propertyId) ?? null : null;
    lead.agent = this.agents.agents.get(lead.agentId)!;
    this.leads.set(lead.id, lead);
    return Promise.resolve(lead);
  }

  remove(lead: Lead): Promise<Lead> {
    this.leads.delete(lead.id);
    return Promise.resolve(lead);
  }

  findOne(options: FindOneOptions<Lead>): Promise<Lead | null> {
    const where = options.where as FindOptionsWhere<Lead>;
    return Promise.resolve([...this.leads.values()].find((lead) => this.matches(lead, where)) ?? null);
  }

  findAndCount(options: FindManyOptions<Lead>): Promise<[Lead[], number]> {
    const where = options.where;
    const matching = [...this.leads.values()].filter((lead) => !where || (Array.isArray(where)
      ? where.some((candidate) => this.matches(lead, candidate)) : this.matches(lead, where)));
    matching.sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime() || second.id.localeCompare(first.id));
    const total = matching.length;
    const start = options.skip ?? 0;
    return Promise.resolve([matching.slice(start, start + (options.take ?? matching.length)), total]);
  }

  private matches(lead: Lead, where: FindOptionsWhere<Lead>): boolean {
    return Object.entries(where).every(([field, expected]) => {
      const actual = lead[field as keyof Lead];
      if (expected instanceof FindOperator) return this.matchesOperator(actual, expected);
      if (field === 'agent' && typeof expected === 'object' && expected !== null) {
        return Object.entries(expected).every(([key, value]) => lead.agent?.[key as keyof Agent] === value);
      }
      return actual === expected;
    });
  }

  private matchesOperator(actual: unknown, operator: FindOperator<unknown>): boolean {
    const value = operator.value;
    if (operator.type === 'between' && Array.isArray(value)) {
      if (!(actual instanceof Date)) return false;
      return actual.getTime() >= new Date(value[0] as string).getTime()
        && actual.getTime() <= new Date(value[1] as string).getTime();
    }
    if (operator.type === 'moreThanOrEqual') return actual instanceof Date && actual.getTime() >= new Date(value as string).getTime();
    if (operator.type === 'lessThanOrEqual') return actual instanceof Date && actual.getTime() <= new Date(value as string).getTime();
    if (operator.type === 'ilike') {
      const text = typeof actual === 'string' ? actual.toLowerCase() : '';
      const pattern = String(value).replace(/%/g, '').replace(/\\([%_])/g, '$1').toLowerCase();
      return text.includes(pattern);
    }
    throw new Error(`Unsupported test operator: ${operator.type}`);
  }
}
