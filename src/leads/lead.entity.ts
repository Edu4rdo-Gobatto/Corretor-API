import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { Property } from '../properties/property.entity';

@Entity('leads')
@Index('IDX_leads_agent_created', ['agentId', 'createdAt'])
@Index('IDX_leads_property_created', ['propertyId', 'createdAt'])
@Index('IDX_leads_created_at', ['createdAt'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'property_id', type: 'uuid', nullable: true })
  propertyId!: string | null;

  @ManyToOne(() => Property, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_id' })
  property!: Relation<Property> | null;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => Agent, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Relation<Agent>;

  @Column({ name: 'lead_name', type: 'text' })
  leadName!: string;

  @Column({ name: 'lead_phone', type: 'text' })
  leadPhone!: string;

  @Column({ name: 'lead_email', type: 'text', nullable: true })
  leadEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ name: 'consent_given', type: 'boolean' })
  consentGiven!: boolean;

  @Column({ name: 'consent_timestamp', type: 'timestamptz' })
  consentTimestamp!: Date;

  @Column({ name: 'consent_ip', type: 'text' })
  consentIp!: string;

  @Column({ name: 'terms_version', type: 'text', default: 'v1.0' })
  termsVersion!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
