import { RentalParty } from '../rentals/rental-party.entity';
import { Lease } from '../rentals/lease.entity';
import { RentalDocument } from '../rentals/rental-document.entity';
import { CreateRentalAdministration1789257600000 } from './migrations/1789257600000-create-rental-administration';
import { AcquisitionCommission, CommissionInstallment } from '../finance/commission.entity';
import { CreateAcquisitionCommissions1789344000000 } from './migrations/1789344000000-create-acquisition-commissions';
import { RentPayment } from '../finance/rent-payment.entity';
import { CreateRentPayments1789430400000 } from './migrations/1789430400000-create-rent-payments';
import { RefreshSession } from '../auth/refresh-session.entity';
import { CreateRefreshSessions1789084804000 } from './migrations/1789084804000-create-refresh-sessions';
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
  entities: [Agent, Property, PropertyMedia, Lead, RefreshSession, RentalParty, Lease, RentalDocument, AcquisitionCommission, CommissionInstallment, RentPayment],
  migrations: [CreateAgents1789084800000, CreateProperties1789084801000, CreatePropertyMedia1789084802000, CreateLeads1789084803000, CreateRefreshSessions1789084804000, CreateRentalAdministration1789257600000, CreateAcquisitionCommissions1789344000000, CreateRentPayments1789430400000],
  migrationsTableName: 'typeorm_migrations',
});
