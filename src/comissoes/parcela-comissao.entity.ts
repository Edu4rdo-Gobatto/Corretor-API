import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Comissao } from './comissao.entity';

@Entity('parcelas_comissao')
@Unique(['comissao_id', 'numero_parcela'])
export class ParcelaComissao extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'integer' }) comissao_id!: number;
  @ManyToOne(() => Comissao, comissao => comissao.parcelas, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'comissao_id' }) comissao!: Comissao;
  @Column({ type: 'int' }) numero_parcela!: number;
  @Column({ type: 'date' }) data_vencimento!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) valor!: string;
  @Column({ type: 'enum', enum: ['PENDENTE', 'PAGO', 'ATRASADO'], enumName: 'status_parcela_comissao', default: 'PENDENTE' }) status!: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  @Column({ type: 'timestamptz', nullable: true }) pago_em!: Date | null;
  @Column({ type: 'text', nullable: true }) observacao_pagamento!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}
