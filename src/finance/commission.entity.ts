import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { Lease } from '../rentals/lease.entity';

export enum CommissionInstallmentStatus { PENDING = 'PENDING', PAID = 'PAID' }

@Entity('acquisition_commissions')
export class AcquisitionCommission {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'lease_id', type: 'uuid', unique: true }) leaseId!: string;
  @ManyToOne(() => Lease, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'lease_id' }) lease!: Relation<Lease>;
  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 }) totalAmount!: string;
  @Column({ name: 'installment_count', type: 'integer' }) installmentCount!: number;
  @Column({ type: 'text' }) notes!: string;
  @OneToMany(() => CommissionInstallment, installment => installment.commission, { cascade: true }) installments!: Relation<CommissionInstallment[]>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity('commission_installments')
export class CommissionInstallment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'commission_id', type: 'uuid' }) commissionId!: string;
  @ManyToOne(() => AcquisitionCommission, commission => commission.installments, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'commission_id' }) commission!: Relation<AcquisitionCommission>;
  @Column({ name: 'installment_number', type: 'integer' }) installmentNumber!: number;
  @Column({ type: 'date' }) dueDate!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount!: string;
  @Column({ type: 'enum', enum: CommissionInstallmentStatus, enumName: 'CommissionInstallmentStatus', default: CommissionInstallmentStatus.PENDING }) status!: CommissionInstallmentStatus;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt!: Date | null;
  @Column({ name: 'payment_note', type: 'text', nullable: true }) paymentNote!: string | null;
}

export function commissionResponse(c: AcquisitionCommission) {
  const paid = c.installments?.filter(i => i.status === CommissionInstallmentStatus.PAID).reduce((sum, i) => sum + BigInt(i.amount.replace('.', '')), 0n) ?? 0n;
  return { id: c.id, leaseId: c.leaseId, totalAmount: c.totalAmount, installmentCount: c.installmentCount, paidAmount: `${paid / 100n}.${(paid % 100n).toString().padStart(2, '0')}`, balanceAmount: `${(BigInt(c.totalAmount.replace('.', '')) - paid) / 100n}.${((BigInt(c.totalAmount.replace('.', '')) - paid) % 100n).toString().padStart(2, '0')}`, notes: c.notes, installments: c.installments?.map(i => ({ id: i.id, installmentNumber: i.installmentNumber, dueDate: i.dueDate, amount: i.amount, status: i.status, paidAt: i.paidAt, paymentNote: i.paymentNote })) ?? [] };
}
