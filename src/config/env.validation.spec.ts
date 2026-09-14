import { validateEnvironment } from './env.validation';

const validEnvironment = {
  DATABASE_URL: 'postgresql://agent:sample-password@ep-test.neon.tech/corretor?sslmode=require',
  JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
  R2_ENDPOINT: 'https://sample-account.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-storage-secret',
  R2_PUBLIC_URL: 'https://pub-sample.r2.dev',
};

describe('environment validation', () => {
  it('starts without legacy column encryption and rejects incomplete Drive configuration without revealing keys', () => {
    expect(() => validateEnvironment(validEnvironment)).not.toThrow();
    expect(() => validateEnvironment({ ...validEnvironment, GOOGLE_DRIVE_CLIENT_EMAIL: 'conta@example.test' })).toThrow('GOOGLE_DRIVE');
    expect(() => validateEnvironment({ ...validEnvironment, GOOGLE_DRIVE_PRIVATE_KEY: 'private-key-never-print' })).toThrow('GOOGLE_DRIVE');
    try { validateEnvironment({ ...validEnvironment, GOOGLE_DRIVE_PRIVATE_KEY: 'private-key-never-print' }); }
    catch (erro) { expect((erro as Error).message).not.toContain('private-key-never-print'); }
  });
  it('accepts valid configuration and applies documented defaults', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      ...validEnvironment,
      PORT: 3000,
      NODE_ENV: 'development',
      JWT_EXPIRES_IN: '15m',
    });
  });

  it('converts a configured port without mutating the input', () => {
    const environment = { ...validEnvironment, PORT: '4000' };
    expect(validateEnvironment(environment).PORT).toBe(4000);
    expect(environment.PORT).toBe('4000');
  });

  it('accepts the Neon URL with channel binding enabled', () => {
    const environment = {
      ...validEnvironment,
      DATABASE_URL: `${validEnvironment.DATABASE_URL}&channel_binding=require`,
    };
    expect(validateEnvironment(environment).DATABASE_URL).toBe(environment.DATABASE_URL);
  });

  it.each(Object.keys(validEnvironment))('rejects missing %s', (field) => {
    const environment: Record<string, unknown> = { ...validEnvironment };
    delete environment[field];
    expect(() => validateEnvironment(environment)).toThrow(field);
  });

  it.each([
    ['PORT', ''], ['PORT', 'abc'], ['PORT', '0'], ['PORT', '65536'], ['PORT', '3.5'],
    ['NODE_ENV', 'staging'], ['JWT_SECRET', 'short'], ['JWT_SECRET', ' '.repeat(40)],
    ['JWT_EXPIRES_IN', '0d'], ['JWT_EXPIRES_IN', 'forever'], ['JWT_EXPIRES_IN', '3600'],
    ['DATABASE_URL', 'not-a-url'],
    ['DATABASE_URL', 'postgresql://user:pass@localhost/db?sslmode=require'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech/db'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech/db?sslmode=disable'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech.evil.example/db?sslmode=require'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech/db?sslmode=require&ssl=0&host=localhost'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech/db?sslmode=require&host=localhost'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech/db?sslmode=require&ssl=0'],
    ['DATABASE_URL', 'postgresql://user:pass@ep-test.neon.tech/db?sslmode=require&sslmode=disable'],
    ['R2_ENDPOINT', 'http://sample-account.r2.cloudflarestorage.com'],
    ['R2_PUBLIC_URL', 'not-a-url'], ['R2_PUBLIC_URL', 'http://pub-sample.r2.dev'],
    ['R2_ACCESS_KEY_ID', ''], ['R2_SECRET_ACCESS_KEY', '   '],
  ])('rejects invalid %s (%s)', (field, value) => {
    expect(() => validateEnvironment({ ...validEnvironment, [field]: value })).toThrow(field);
  });

  it('reports all invalid fields without exposing any values or unrelated environment secrets', () => {
    const secret = 'do-not-print-this-secret';
    try {
      validateEnvironment({ DATABASE_URL: secret, JWT_SECRET: secret, UNRELATED_SECRET: secret });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('JWT_SECRET');
      expect(message).not.toContain(secret);
      expect(message).not.toContain('UNRELATED_SECRET');
    }
  });
});
