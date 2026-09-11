import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AgentProfile } from '../agents/dto/agent-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrowserOriginGuard } from '../auth/browser-origin.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { LeadsService } from './leads.service';
import { LeadRateGuard } from './lead-rate.guard';

type AuthenticatedRequest = Request & { user: AgentProfile };

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @UseGuards(BrowserOriginGuard, LeadRateGuard)
  create(@Body() dto: CreateLeadDto, @Req() request: Request) {
    return this.leads.create(dto, request.ip ?? 'unknown');
  }
}

@Controller('admin/leads')
@UseGuards(JwtAuthGuard)
export class ManagedLeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@Query() query: LeadQueryDto, @Req() request: AuthenticatedRequest) {
    return this.leads.list(query, request.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: AuthenticatedRequest) {
    return this.leads.remove(id, request.user);
  }
}
