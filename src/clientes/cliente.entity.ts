import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';

export enum OrigemCliente { SITE = 'SITE', MANUAL = 'MANUAL' }

@Entity('clientes')
export class Cliente extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) imovel_id!: string | null;
  @ManyToOne(() => Imovel, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel> | null;
  @Column({ type: 'uuid' }) corretor_id!: string;
  @ManyToOne(() => Corretor, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'corretor_id' }) corretor!: Relation<Corretor>;
  @Column({ type: 'text' }) nome!: string;
  @Column({ type: 'text' }) telefone!: string;
  @Column({ type: 'text', nullable: true }) email!: string | null;
  @Column({ type: 'text', nullable: true }) mensagem!: string | null;
  @Column({ type: 'enum', enum: OrigemCliente, enumName: 'origem_cliente', default: OrigemCliente.SITE }) origem!: OrigemCliente;
  @Column({ type: 'boolean', default: false }) consentimento!: boolean;
  @Column({ type: 'text', nullable: true }) consentimento_ip!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) consentimento_em!: Date | null;
  @Column({ type: 'text', nullable: true, default: 'v1.0' }) versao_termos!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}
