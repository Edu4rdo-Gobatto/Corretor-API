import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AgentRole } from '../agents/agent.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LeasesService } from './leases.service';
import { LeaseDto, LeaseQuery } from './rental.dto';
import { RentalPrivacyInterceptor } from './rental-privacy.interceptor';
@Controller('admin/leases')
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(AgentRole.ADMIN) @UseInterceptors(RentalPrivacyInterceptor)
export class LeasesController {
  constructor(private readonly leases: LeasesService) {}
  @Get() list(@Query() query: LeaseQuery) { return this.leases.list(query); }
  @Get(':id') get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.leases.get(id); }
  @Post() create(@Body() dto: LeaseDto) { return this.leases.save(dto); }
  @Patch(':id') update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: LeaseDto) { return this.leases.save(dto, id); }
}
