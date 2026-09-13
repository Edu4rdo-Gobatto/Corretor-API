import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { Property } from '../properties/property.entity';
import { RentalParty } from './rental-party.entity';
import { rentalEncryption } from './rental-encryption';
@Entity('leases')
export class Lease {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) reference!: string;
  @Column({ name: 'property_id', type: 'uuid' }) propertyId!: string;
  @ManyToOne(() => Property, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'property_id' }) property!: Relation<Property>;
  @Column({ name: 'owner_id', type: 'uuid' }) ownerId!: string;
  @ManyToOne(() => RentalParty, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'owner_id' }) owner!: Relation<RentalParty>;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId!: string;
  @ManyToOne(() => RentalParty, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'tenant_id' }) tenant!: Relation<RentalParty>;
  @Column({ name: 'start_date', type: 'date' }) startDate!: string;
  @Column({ name: 'end_date', type: 'date' }) endDate!: string;
  @Column({ name: 'rent_amount', type: 'numeric', precision: 12, scale: 2 }) rentAmount!: string;
  @Column({ name: 'due_day', type: 'integer' }) dueDay!: number;
  @Column({ type: 'text' }) status!: 'DRAFT' | 'ACTIVE' | 'ENDED';
  @Column({ type: 'text', transformer: rentalEncryption }) notes!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
export function leaseResponse(l: Lease) {
  return { id: l.id, reference: l.reference, propertyId: l.propertyId, ownerId: l.ownerId, tenantId: l.tenantId,
    propertyTitle: l.property?.title, ownerName: l.owner?.name, tenantName: l.tenant?.name,
    startDate: l.startDate, endDate: l.endDate, rentAmount: l.rentAmount, dueDay: l.dueDay, status: l.status, notes: l.notes, createdAt: l.createdAt, updatedAt: l.updatedAt };
}
