import { ConfigService } from '@nestjs/config';
import { Client, type ClientConfig } from 'pg';
import { createDatabaseOptions } from './database.config';

describe('database configuration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('requires a connection URL instead of falling back to a local database', () => {
    jest.replaceProperty(process, 'env', {});
    const configuration = new ConfigService();
    expect(() => createDatabaseOptions(configuration)).toThrow('DATABASE_URL');
  });

  it('keeps credentials and connection parameters while enforcing verified TLS and disabling automatic schema changes', () => {
    const configuration = new ConfigService({
      DATABASE_URL: 'postgresql://agent:password@ep-test.neon.tech/corretor?sslmode=require&channel_binding=require',
    });
    const options = createDatabaseOptions(configuration);
    expect(options).toMatchObject({
      type: 'postgres',
      synchronize: false,
      migrationsRun: false,
      installExtensions: false,
      uuidExtension: 'pgcrypto',
      autoLoadEntities: true,
      ssl: { rejectUnauthorized: true },
      logging: false,
    });
    if (options.type !== 'postgres') throw new Error('Expected PostgreSQL configuration');
    const connection = new URL(options.url!);
    expect(connection.hostname).toBe('ep-test.neon.tech');
    expect(connection.username).toBe('agent');
    expect(connection.password).toBe('password');
    expect(connection.pathname).toBe('/corretor');
    expect(connection.searchParams.get('channel_binding')).toBe('require');
    expect(connection.searchParams.has('sslmode')).toBe(false);
    // Construction parses the effective driver settings without opening a connection.
    const client = new Client({ connectionString: options.url, ssl: options.ssl as ClientConfig['ssl'] });
    expect(client.host).toBe('ep-test.neon.tech');
    expect(client.ssl).toMatchObject({ rejectUnauthorized: true });
  });
});
