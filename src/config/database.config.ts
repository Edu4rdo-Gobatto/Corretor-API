import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export function createDatabaseOptions(configuration: ConfigService): TypeOrmModuleOptions {
  return {
    ...createPostgresOptions(configuration.getOrThrow<string>('DATABASE_URL')),
    autoLoadEntities: true,
    retryAttempts: 1,
  };
}

export function createPostgresOptions(databaseUrl: string): PostgresConnectionOptions {
  const connection = new URL(databaseUrl);
  // pg URL SSL parameters override the explicit TLS object; enforce verification here.
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    connection.searchParams.delete(parameter);
  }

  return {
    type: 'postgres',
    url: connection.toString(),
    ssl: { rejectUnauthorized: true },
    synchronize: false,
    migrationsRun: false,
    // PostgreSQL 16 provides gen_random_uuid(); boot must not CREATE EXTENSION.
    installExtensions: false,
    uuidExtension: 'pgcrypto',
    logging: false,
    extra: { connectionTimeoutMillis: 10_000 },
  };
}
