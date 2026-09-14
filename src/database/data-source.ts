import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createPostgresOptions } from '../config/database.config';
import { validateEnvironment } from '../config/env.validation';
import { entidades, migracoes } from './registros';

const ambiente = validateEnvironment(process.env);
export default new DataSource({
  ...createPostgresOptions(ambiente.DATABASE_URL), entities: entidades,
  migrations: migracoes, migrationsTableName: 'typeorm_migrations',
});
