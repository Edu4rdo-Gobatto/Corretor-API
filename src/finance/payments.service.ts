import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { Lease } from '../rentals/lease.entity';
import { CreatePaymentDto, PaymentQueryDto } from './payment.dto';
import { RentPayment, RentPaymentStatus, paymentResponse } from './rent-payment.entity';

function cents(v: string): bigint { if (!/^\d{1,10}\.\d{2}$/.test(v) || /^0\.00$/.test(v)) throw new BadRequestException('Valor recebido inválido.'); return BigInt(v.replace('.', '')); }
function money(v: bigint): string { return `${v / 100n}.${(v % 100n).toString().padStart(2, '0')}`; }
@Injectable()
export class PaymentsService {
  constructor(@InjectRepository(RentPayment) private readonly payments: Repository<RentPayment>, @InjectRepository(Lease) private readonly leases: Repository<Lease>) {}
  async list(q: PaymentQueryDto) {
    const where: FindOptionsWhere<RentPayment> = { ...(q.leaseId ? { leaseId: q.leaseId } : {}), ...(q.status ? { status: q.status as RentPaymentStatus } : {}), ...(q.from || q.to ? { referenceMonth: Between(q.from ?? '1900-01-01', q.to ?? '2199-12-01') } : {}) };
    const [items, total] = await this.payments.findAndCount({ where, relations: { lease: { property: true, owner: true } }, order: { referenceMonth: 'DESC', id: 'DESC' }, skip: (q.page - 1) * q.limit, take: q.limit });
    return { items: items.map(paymentResponse), total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) };
  }
  async create(dto: CreatePaymentDto) {
    const amount = cents(dto.receivedAmount); const lease = await this.leases.findOne({ where: { id: dto.leaseId }, relations: { owner: true } });
    if (!lease) throw new NotFoundException('Contrato não encontrado.'); if (lease.status !== 'ACTIVE') throw new BadRequestException('Somente contratos ativos recebem pagamentos.');
    if (await this.payments.existsBy({ leaseId: dto.leaseId, referenceMonth: dto.referenceMonth })) throw new ConflictException('Este mês já possui pagamento registrado.');
    const payment = this.payments.create({ leaseId: lease.id, lease, referenceMonth: dto.referenceMonth, receivedAmount: dto.receivedAmount, commissionAmount: '0.00', netAmount: money(amount), status: RentPaymentStatus.RECEIVED, receivedAt: new Date(), paidOutAt: null, paymentNote: dto.paymentNote });
    return paymentResponse(await this.payments.save(payment));
  }
  async payout(id: string) { const payment = await this.payments.findOne({ where: { id } }); if (!payment) throw new NotFoundException('Pagamento não encontrado.'); if (payment.status === RentPaymentStatus.PAID_OUT) throw new ConflictException('Este repasse já foi confirmado.'); payment.status = RentPaymentStatus.PAID_OUT; payment.paidOutAt = new Date(); return paymentResponse(await this.payments.save(payment)); }
}
