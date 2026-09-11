import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../agents/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { Property } from '../properties/property.entity';
import { Lead } from './lead.entity';
import { LeadsController, ManagedLeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadRateGuard } from './lead-rate.guard';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Lead, Property, Agent])],
  controllers: [LeadsController, ManagedLeadsController],
  providers: [LeadsService, LeadRateGuard],
  exports: [LeadsService],
})
export class LeadsModule {}
