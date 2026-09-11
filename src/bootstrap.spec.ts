import { spawnSync } from 'node:child_process';

describe('application startup', () => {
  it('rejects invalid initial administrator input before loading the database', () => {
    const result = spawnSync(process.execPath, ['-r', 'ts-node/register', 'src/commands/bootstrap-admin.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, BOOTSTRAP_ADMIN_PASSWORD: 'secret', BOOTSTRAP_ADMIN_EMAIL: 'invalid' },
      encoding: 'utf8', timeout: 15_000,
    });
    const output = result.stdout + result.stderr;
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(output).toContain('BOOTSTRAP_ADMIN_PASSWORD');
    expect(output).not.toContain('secret');
    expect(output).not.toContain('Unable to connect');
  }, 20_000);

  it('exits before connecting or listening when required configuration is missing, without printing secrets', () => {
    const environment = { ...process.env };
    for (const field of [
      'PORT', 'NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN',
      'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL',
    ]) {
      delete environment[field];
    }
    environment.DATABASE_URL = 'must-never-be-printed';
    environment.JWT_SECRET = 'another-private-value';
    const result = spawnSync(process.execPath, ['-r', 'ts-node/register', 'src/main.ts'], {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
      timeout: 15_000,
    });
    const output = result.stdout + result.stderr;
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(output).toContain('Configuração de ambiente inválida');
    expect(output).toContain('DATABASE_URL');
    expect(output).toContain('JWT_SECRET');
    expect(output).not.toContain('must-never-be-printed');
    expect(output).not.toContain('another-private-value');
    expect(output).not.toContain('Unable to connect');
    expect(output).not.toContain('Nest application successfully started');
  }, 20_000);
});
