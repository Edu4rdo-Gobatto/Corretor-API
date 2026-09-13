import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AgentRole } from '../agents/agent.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RentalPartiesService } from './rental-parties.service';
import { PartyDto, PartyQuery } from './rental.dto';
import { RentalPrivacyInterceptor } from './rental-privacy.interceptor';
@Controller('admin/rental-parties')
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(AgentRole.ADMIN) @UseInterceptors(RentalPrivacyInterceptor)
export class RentalPartiesController {
  constructor(private readonly parties: RentalPartiesService) {}
  @Get() list(@Query() query: PartyQuery) { return this.parties.list(query); }
  @Get(':id') get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.parties.get(id); }
  @Post() create(@Body() dto: PartyDto) { return this.parties.save(dto); }
  @Patch(':id') update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: PartyDto) { return this.parties.save(dto, id); }
}
