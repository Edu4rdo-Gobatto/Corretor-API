import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { Lease } from '../rentals/lease.entity';
export enum RentPaymentStatus { RECEIVED='RECEIVED', PAID_OUT='PAID_OUT' }
@Entity('rent_payments')
export class RentPayment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({name:'lease_id',type:'uuid'}) leaseId!: string;
  @ManyToOne(()=>Lease,{onDelete:'RESTRICT'}) @JoinColumn({name:'lease_id'}) lease!: Relation<Lease>;
  @Column({name:'reference_month',type:'date'}) referenceMonth!: string;
  @Column({name:'received_amount',type:'numeric',precision:12,scale:2}) receivedAmount!: string;
  @Column({name:'commission_amount',type:'numeric',precision:12,scale:2}) commissionAmount!: string;
  @Column({name:'net_amount',type:'numeric',precision:12,scale:2}) netAmount!: string;
  @Column({type:'enum',enum:RentPaymentStatus,enumName:'RentPaymentStatus',default:RentPaymentStatus.RECEIVED}) status!: RentPaymentStatus;
  @Column({name:'received_at',type:'timestamptz'}) receivedAt!: Date;
  @Column({name:'paid_out_at',type:'timestamptz',nullable:true}) paidOutAt!: Date|null;
  @Column({name:'payment_note',type:'text',nullable:true}) paymentNote!: string|null;
  @CreateDateColumn({name:'created_at',type:'timestamptz'}) createdAt!: Date;
  @UpdateDateColumn({name:'updated_at',type:'timestamptz'}) updatedAt!: Date;
}
export function paymentResponse(p: RentPayment) { return {id:p.id,leaseId:p.leaseId,referenceMonth:p.referenceMonth,receivedAmount:p.receivedAmount,commissionAmount:p.commissionAmount,netAmount:p.netAmount,status:p.status,receivedAt:p.receivedAt,paidOutAt:p.paidOutAt,paymentNote:p.paymentNote}; }
