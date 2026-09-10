import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { createPostgresOptions } from '../config/database.config';
import { validateEnvironment } from '../config/env.validation';
import { CreateAgents1789084800000 } from './migrations/1789084800000-create-agents';
import { Property } from '../properties/property.entity';
import { CreateProperties1789084801000 } from './migrations/1789084801000-create-properties';
import { PropertyMedia } from '../media/property-media.entity';
import { CreatePropertyMedia1789084802000 } from './migrations/1789084802000-create-property-media';
import { Lead } from '../leads/lead.entity';
import { CreateLeads1789084803000 } from './migrations/1789084803000-create-leads';

const environment = validateEnvironment(process.env);

export default new DataSource({
  ...createPostgresOptions(environment.DATABASE_URL),
  entities: [Agent, Property, PropertyMedia, Lead],
  migrations: [CreateAgents1789084800000, CreateProperties1789084801000, CreatePropertyMedia1789084802000, CreateLeads1789084803000],
  migrationsTableName: 'typeorm_migrations',
});
