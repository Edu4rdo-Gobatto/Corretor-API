import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Lease } from '../rentals/lease.entity';
import { AcquisitionCommission, CommissionInstallment } from './commission.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { RentPayment } from './rent-payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Lease, AcquisitionCommission, CommissionInstallment, RentPayment])], controllers: [FinanceController, PaymentsController], providers: [FinanceService, PaymentsService] })
export class FinanceModule {}
