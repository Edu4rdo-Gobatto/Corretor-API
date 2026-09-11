import { randomUUID } from 'node:crypto';
import { DeepPartial, FindOneOptions, FindOptionsWhere, QueryFailedError } from 'typeorm';
import { Agent, AgentRole } from '../agents/agent.entity';

// Only the external persistence boundary is replaced; HTTP, DTOs, hashing and JWT stay real.
export class AgentRepositoryFixture {
  readonly agents = new Map<string, Agent>();

  readonly manager = {
    transaction: async <T>(action: (manager: { query: () => Promise<void>; getRepository: () => AgentRepositoryFixture }) => Promise<T>): Promise<T> =>
      action({ query: () => Promise.resolve(), getRepository: () => this }),
  };

  findAndCount(options: { skip?: number; take?: number }): Promise<[Agent[], number]> {
    const agents = [...this.agents.values()].sort((first, second) => first.name.localeCompare(second.name));
    return Promise.resolve([agents.slice(options.skip ?? 0, (options.skip ?? 0) + (options.take ?? agents.length)), agents.length]);
  }

  countBy(where: FindOptionsWhere<Agent>): Promise<number> {
    return Promise.resolve([...this.agents.values()].filter(agent => Object.entries(where).every(([key, value]) => agent[key as keyof Agent] === value)).length);
  }

  create(agent: DeepPartial<Agent>): Agent {
    return Object.assign(new Agent(), {
      id: randomUUID(),
      role: AgentRole.AGENT,
      active: true,
      creci: null,
      avatarUrl: null,
      createdAt: new Date(),
    }, agent);
  }

  save(agent: Agent): Promise<Agent> {
    if ([...this.agents.values()].some((existing) => existing.email === agent.email && existing.id !== agent.id)) {
      return Promise.reject(new QueryFailedError('INSERT INTO agents', [], Object.assign(new Error('duplicate'), { code: '23505' })));
    }
    this.agents.set(agent.id, agent);
    return Promise.resolve(agent);
  }

  findOne(options: FindOneOptions<Agent>): Promise<Agent | null> {
    return this.findOneBy(options.where as FindOptionsWhere<Agent>);
  }

  findOneBy(where: FindOptionsWhere<Agent>): Promise<Agent | null> {
    const agent = [...this.agents.values()].find((candidate) =>
      Object.entries(where).every(([key, value]) => candidate[key as keyof Agent] === value),
    );
    return Promise.resolve(agent ?? null);
  }

  async existsBy(where: FindOptionsWhere<Agent>): Promise<boolean> {
    return (await this.findOneBy(where)) !== null;
  }
}
