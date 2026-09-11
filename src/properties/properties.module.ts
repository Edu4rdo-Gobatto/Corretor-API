import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { ManagedPropertiesController, PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property]), AgentsModule],
  controllers: [PropertiesController, ManagedPropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
