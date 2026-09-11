import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn, ValueTransformer } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { PropertyMedia } from '../media/property-media.entity';

export enum PropertyType { GALPAO = 'GALPAO', SALA = 'SALA', PREDIO = 'PREDIO', LOJA = 'LOJA', TERRENO = 'TERRENO' }
export enum PropertyPurpose { LOCACAO = 'LOCACAO', VENDA = 'VENDA' }
export enum PropertyStatus { DISPONIVEL = 'DISPONIVEL', RESERVADO = 'RESERVADO', CONCLUIDO = 'CONCLUIDO' }

const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => value === null ? null : Number(value),
};

@Entity('properties')
@Index('IDX_properties_agent_id', ['agentId'])
@Index('IDX_properties_public_created', ['status', 'createdAt'])
@Check('CHK_properties_areas', '"usable_area" > 0 AND "total_area" >= "usable_area"')
@Check('CHK_properties_prices', '"price" >= 0 AND ("condo_fee" IS NULL OR "condo_fee" >= 0) AND ("iptu_fee" IS NULL OR "iptu_fee" >= 0)')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'enum', enum: PropertyType, enumName: 'PropertyType' })
  type!: PropertyType;

  @Column({ type: 'enum', enum: PropertyPurpose, enumName: 'PropertyPurpose' })
  purpose!: PropertyPurpose;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  price!: number;

  @Column({ name: 'condo_fee', type: 'numeric', precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  condoFee!: number | null;

  @Column({ name: 'iptu_fee', type: 'numeric', precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  iptuFee!: number | null;

  @Column({ name: 'usable_area', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  usableArea!: number;

  @Column({ name: 'total_area', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  totalArea!: number;

  @Column({ name: 'address_street', type: 'text' })
  addressStreet!: string;

  @Column({ name: 'address_number', type: 'text' })
  addressNumber!: string;

  @Column({ name: 'address_city', type: 'text' })
  addressCity!: string;

  @Column({ name: 'address_state', type: 'text' })
  addressState!: string;

  @Column({ type: 'text' })
  neighborhood!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'jsonb', default: {} })
  features!: Record<string, unknown>;

  @Column({ type: 'enum', enum: PropertyStatus, enumName: 'PropertyStatus', default: PropertyStatus.DISPONIVEL })
  status!: PropertyStatus;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => Agent, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Relation<Agent>;

  @OneToMany(() => PropertyMedia, (media) => media.property)
  media!: Relation<PropertyMedia[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
