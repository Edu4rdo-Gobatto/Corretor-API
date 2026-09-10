import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AgentRole } from './agent.entity';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AgentRole.ADMIN)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.agents.create(dto);
  }
}
