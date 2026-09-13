import { randomUUID } from 'node:crypto';
import { DeepPartial, FindManyOptions, FindOneOptions, FindOperator, FindOptionsWhere } from 'typeorm';
import { Property, PropertyStatus } from '../properties/property.entity';
import { AgentRepositoryFixture } from './agent-repository.fixture';

export class PropertyRepositoryFixture {
  readonly properties = new Map<string, Property>();

  constructor(private readonly agents: AgentRepositoryFixture) {}

  create(fields: DeepPartial<Property>): Property {
    return Object.assign(new Property(), { id: randomUUID(), condoFee: null, iptuFee: null,
      features: {}, status: PropertyStatus.DISPONIVEL, createdAt: new Date(), updatedAt: new Date() }, fields);
  }

  save(property: Property): Promise<Property> {
    property.agent = this.agents.agents.get(property.agentId)!;
    this.properties.set(property.id, property);
    return Promise.resolve(property);
  }

  remove(property: Property): Promise<Property> {
    this.properties.delete(property.id);
    return Promise.resolve(property);
  }

  findOne(options: FindOneOptions<Property>): Promise<Property | null> {
    return Promise.resolve(this.filtered(options.where as FindOptionsWhere<Property>)[0] ?? null);
  }

  findAndCount(options: FindManyOptions<Property>): Promise<[Property[], number]> {
    const matching = this.filtered(options.where as FindOptionsWhere<Property>);
    matching.sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime() || second.id.localeCompare(first.id));
    const start = options.skip ?? 0;
    return Promise.resolve([matching.slice(start, start + (options.take ?? matching.length)), matching.length]);
  }

  private filtered(where: FindOptionsWhere<Property>): Property[] {
    return [...this.properties.values()].filter((property) => {
      property.agent = this.agents.agents.get(property.agentId)!;
      return Object.entries(where).every(([field, expected]) => {
        const actual = property[field as keyof Property];
        if (expected instanceof FindOperator) {
          const value: unknown = expected.value;
          if (expected.type === 'between' && Array.isArray(value)) {
            return typeof actual === 'number' && actual >= Number(value[0]) && actual <= Number(value[1]);
          }
          if (expected.type === 'ilike') {
            const actualText = typeof actual === 'string' || typeof actual === 'number' ? String(actual) : '';
            const pattern = String(value);
            if (pattern.startsWith('%') && pattern.endsWith('%')) return actualText.toLowerCase().includes(pattern.slice(1, -1).replace(/\\([%_\\])/g, '$1').toLowerCase());
            return actualText.toLowerCase() === pattern.replace(/\\([%_\\])/g, '$1').toLowerCase();
          }
          throw new Error(`Unsupported test operator: ${expected.type}`);
        }
        if (field === 'agent' && typeof expected === 'object' && expected !== null) {
          return Object.entries(expected).every(([key, value]) => property.agent[key as keyof typeof property.agent] === value);
        }
        return actual === expected;
      });
    });
  }
}
