import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PasswordService } from '../common/security/password.service';
import { AgentRepositoryFixture } from '../testing/agent-repository.fixture';
import { Agent, AgentRole } from './agent.entity';
import { AgentsService } from './agents.service';

describe('agent persistence boundary', () => {
  let repository: AgentRepositoryFixture;
  let agents: AgentsService;
  const dto = {
    name: 'First admin', email: 'admin@example.com', password: 'test-admin-password',
    whatsappNumber: '5565999999999', role: AgentRole.AGENT,
  };

  beforeEach(() => {
    repository = new AgentRepositoryFixture();
    agents = new AgentsService(repository as unknown as Repository<Agent>, new PasswordService());
  });

  it('creates the first administrator without returning the hash', async () => {
    const admin = await agents.createInitialAdministrator(dto);
    expect(admin.role).toBe(AgentRole.ADMIN);
    expect(JSON.stringify(admin)).not.toContain('password');
  });

  it('refuses to overwrite or add another bootstrap administrator', async () => {
    const original = await agents.createInitialAdministrator(dto);
    await expect(agents.createInitialAdministrator({ ...dto, email: 'another@example.com' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.agents.size).toBe(1);
    expect(repository.agents.get(original.id)?.email).toBe(dto.email);
  });

  it('translates a unique constraint violation during a concurrent creation into 409', async () => {
    await agents.create(dto);
    // Simulate another request committing after the existence check.
    jest.spyOn(repository, 'existsBy').mockResolvedValue(false);
    await expect(agents.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.agents.size).toBe(1);
  });
});
