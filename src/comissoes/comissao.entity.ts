import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Pessoa } from '../pessoas/pessoa.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { ParcelaComissao } from './parcela-comissao.entity';

@Entity('comissoes')
export class Comissao extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'enum', enum: ['LOCACAO', 'VENDA'], enumName: 'tipo_operacao_comissao' }) tipo_operacao!: 'LOCACAO' | 'VENDA';
  @Column({ type: 'integer', nullable: true }) contrato_id!: number | null;
  @ManyToOne(() => Contrato, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'contrato_id' }) contrato!: Relation<Contrato> | null;
  @Column({ type: 'integer' }) imovel_id!: number;
  @ManyToOne(() => Imovel, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel>;
  @Column({ type: 'integer' }) pessoa_id!: number;
  @ManyToOne(() => Pessoa, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'pessoa_id' }) pessoa!: Relation<Pessoa>;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) valor_total!: string;
  @Column({ type: 'int' }) quantidade_parcelas!: number;
  @Column({ type: 'text', nullable: true }) observacoes!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
  @OneToMany(() => ParcelaComissao, parcela => parcela.comissao) parcelas!: Relation<ParcelaComissao[]>;
}
