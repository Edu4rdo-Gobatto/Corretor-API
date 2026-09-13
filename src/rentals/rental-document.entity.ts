import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { RentalParty } from './rental-party.entity';
import { Lease } from './lease.entity';
@Entity('rental_documents')
export class RentalDocument {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'party_id', type: 'uuid', nullable: true }) partyId!: string | null;
  @ManyToOne(() => RentalParty, { onDelete: 'RESTRICT', nullable: true }) @JoinColumn({ name: 'party_id' }) party!: Relation<RentalParty> | null;
  @Column({ name: 'lease_id', type: 'uuid', nullable: true }) leaseId!: string | null;
  @ManyToOne(() => Lease, { onDelete: 'RESTRICT', nullable: true }) @JoinColumn({ name: 'lease_id' }) lease!: Relation<Lease> | null;
  @Column({ name: 'file_name', type: 'text' }) fileName!: string;
  @Column({ name: 'content_type', type: 'text' }) contentType!: string;
  @Column({ type: 'integer' }) size!: number;
  @Column({ name: 'storage_key', type: 'text' }) storageKey!: string;
  @Column({ type: 'text' }) bucket!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
export function documentResponse(d: RentalDocument) {
  return { id: d.id, partyId: d.partyId, leaseId: d.leaseId, fileName: d.fileName, contentType: d.contentType, size: d.size, createdAt: d.createdAt };
}
