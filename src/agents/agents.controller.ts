import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AgentRole } from './agent.entity';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AgentRole.ADMIN)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Query() query: AgentQueryDto) { return this.agents.list(query); }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateAgentDto) {
    return this.agents.update(id, dto);
  }

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.agents.create(dto);
  }
}
