import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Snapshot imutável de cada plano da comissão (um trigger no banco recusa UPDATE e DELETE). */
@Entity('comissao_revisoes')
@Unique('comissao_revisoes_plano', ['comissao_id', 'versao_plano'])
export class RevisaoComissao {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'integer' }) comissao_id!: number;
  @Column({ type: 'int' }) versao_plano!: number;
  @Column({ type: 'enum', enum: ['LOCACAO', 'VENDA'], enumName: 'tipo_operacao_comissao' }) tipo_operacao!: 'LOCACAO' | 'VENDA';
  @Column({ type: 'integer', nullable: true }) contrato_id!: number | null;
  @Column({ type: 'integer' }) imovel_id!: number;
  @Column({ type: 'integer' }) pessoa_id!: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) valor_total!: string;
  @Column({ type: 'int' }) quantidade_parcelas!: number;
  @Column({ type: 'date' }) primeiro_vencimento!: string;
  /** Nulo nas revisões criadas pela migração (origem MIGRACAO). */
  @Column({ type: 'integer', nullable: true }) autor_id!: number | null;
  @Column({ type: 'text' }) origem!: 'CRIACAO' | 'EDICAO' | 'MIGRACAO';
  @CreateDateColumn({ type: 'timestamptz' }) criado_em!: Date;
}
