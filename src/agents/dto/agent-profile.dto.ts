import { Agent } from '../agent.entity';

export type AgentProfile = Omit<Agent, 'passwordHash' | 'properties'>;

export function toAgentProfile(agent: Agent): AgentProfile {
  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    whatsappNumber: agent.whatsappNumber,
    creci: agent.creci,
    role: agent.role,
    avatarUrl: agent.avatarUrl,
    active: agent.active,
    createdAt: agent.createdAt,
  };
}
