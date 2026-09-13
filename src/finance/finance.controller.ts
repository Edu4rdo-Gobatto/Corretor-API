import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AgentRole } from '../agents/agent.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommissionDto, MarkCommissionPaidDto } from './finance.dto';
import { FinanceService } from './finance.service';
@Controller('admin/finance/commissions')
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(AgentRole.ADMIN)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('lease/:leaseId') get(@Param('leaseId', new ParseUUIDPipe({ version: '4' })) leaseId: string) { return this.finance.get(leaseId); }
  @Post() create(@Body() dto: CommissionDto) { return this.finance.create(dto); }
  @Patch('installments/:id/paid') markPaid(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: MarkCommissionPaidDto) { return this.finance.markPaid(id, dto); }
}
