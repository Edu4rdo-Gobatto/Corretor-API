import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('should pass with valid JWT_EXPIRES_IN', () => {
    expect(() => validateEnvironment({
      DATABASE_URL: 'postgresql://user:pass@example.neon.tech/db?sslmode=require',
      JWT_SECRET: '12345678901234567890123456789012',
      JWT_EXPIRES_IN: '30d',
      R2_ENDPOINT: 'https://example.com',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_PUBLIC_URL: 'https://example.com'
    })).not.toThrow();
  });

  it('should fail with JWT_EXPIRES_IN > 30d', () => {
    expect(() => validateEnvironment({
      DATABASE_URL: 'postgresql://user:pass@example.neon.tech/db?sslmode=require',
      JWT_SECRET: '12345678901234567890123456789012',
      JWT_EXPIRES_IN: '31d',
      R2_ENDPOINT: 'https://example.com',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_PUBLIC_URL: 'https://example.com'
    })).toThrow();
  });
});
