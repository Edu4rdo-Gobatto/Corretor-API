import { AgentRole } from '../agents/agent.entity';
import { parseBootstrapAdministrator } from './bootstrap-admin.config';

describe('initial administrator configuration', () => {
  const environment = {
    BOOTSTRAP_ADMIN_NAME: ' First administrator ',
    BOOTSTRAP_ADMIN_EMAIL: ' ADMIN@EXAMPLE.COM ',
    BOOTSTRAP_ADMIN_PASSWORD: 'local-test-password',
    BOOTSTRAP_ADMIN_WHATSAPP: '5565999999999',
  };

  it('validates and normalizes a complete administrator without taking a role from the environment', () => {
    expect(parseBootstrapAdministrator({ ...environment, BOOTSTRAP_ADMIN_ROLE: 'AGENT' })).toMatchObject({
      name: 'First administrator', email: 'admin@example.com', password: 'local-test-password',
      whatsappNumber: '5565999999999', role: AgentRole.ADMIN,
    });
  });

  it.each(Object.keys(environment))('rejects missing %s before any database work', (field) => {
    const incomplete: NodeJS.ProcessEnv = { ...environment };
    delete incomplete[field];
    expect(() => parseBootstrapAdministrator(incomplete)).toThrow('BOOTSTRAP_ADMIN');
  });

  it('rejects weak passwords without printing them', () => {
    try {
      parseBootstrapAdministrator({ ...environment, BOOTSTRAP_ADMIN_PASSWORD: 'secret' });
      throw new Error('Expected validation error');
    } catch (error) {
      expect((error as Error).message).toContain('BOOTSTRAP_ADMIN_PASSWORD');
      expect((error as Error).message).not.toContain('secret');
    }
  });
});
