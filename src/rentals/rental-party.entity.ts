import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { rentalEncryption } from './rental-encryption';
export interface PartyPrivateData { taxId: string; email: string; phone: string; address: string; birthDate: string; notes: string; bankName: string; bankAgency: string; bankAccount: string; pixKey: string }
@Entity('rental_parties')
export class RentalParty {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text' }) kind!: 'OWNER' | 'TENANT';
  @Column({ name: 'person_type', type: 'text' }) personType!: 'PF' | 'PJ';
  @Column({ type: 'text' }) name!: string;
  @Column({ name: 'private_data', type: 'text', transformer: rentalEncryption }) privateData!: PartyPrivateData;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
export function partyResponse(p: RentalParty) {
  return { id: p.id, kind: p.kind, personType: p.personType, name: p.name, active: p.active, createdAt: p.createdAt, updatedAt: p.updatedAt, ...p.privateData };
}
