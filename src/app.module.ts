import { RentalsModule } from './rentals/rentals.module';
import { FinanceModule } from './finance/finance.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { createDatabaseOptions } from './config/database.config';
import { validateEnvironment } from './config/env.validation';
import { LeadsModule } from './leads/leads.module';
import { MediaModule } from './media/media.module';
import { PropertiesModule } from './properties/properties.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createDatabaseOptions,
    }),
    AuthModule,
    AgentsModule,
    PropertiesModule,
    MediaModule,
    LeadsModule,
    HealthModule,
    RentalsModule,
    FinanceModule,
  ],
})
export class AppModule {}
