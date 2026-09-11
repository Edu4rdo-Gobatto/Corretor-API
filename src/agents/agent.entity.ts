import { Check, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Property } from '../properties/property.entity';

export enum AgentRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

@Entity('agents')
@Check('CHK_agents_email_normalized', '"email" = lower(btrim("email"))')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({ name: 'whatsapp_number', type: 'text' })
  whatsappNumber!: string;

  @Column({ type: 'text', nullable: true })
  creci!: string | null;

  @Column({ type: 'enum', enum: AgentRole, enumName: 'AgentRole', default: AgentRole.AGENT })
  role!: AgentRole;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => Property, (property) => property.agent)
  properties!: Relation<Property[]>;
}
