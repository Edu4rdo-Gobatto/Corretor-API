import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Cliente } from '../clientes/cliente.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { ParcelaComissao } from './parcela-comissao.entity';

@Entity('comissoes')
export class Comissao extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'enum', enum: ['LOCACAO', 'VENDA'], enumName: 'tipo_operacao_comissao' }) tipo_operacao!: 'LOCACAO' | 'VENDA';
  @Column({ type: 'uuid', nullable: true }) contrato_id!: string | null;
  @ManyToOne(() => Contrato, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'contrato_id' }) contrato!: Contrato | null;
  @Column({ type: 'uuid' }) imovel_id!: string;
  @ManyToOne(() => Imovel, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'imovel_id' }) imovel!: Imovel;
  @Column({ type: 'uuid' }) cliente_id!: string;
  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'cliente_id' }) cliente!: Cliente;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) valor_total!: string;
  @Column({ type: 'int' }) quantidade_parcelas!: number;
  @Column({ type: 'text', nullable: true }) observacoes!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
  @OneToMany(() => ParcelaComissao, parcela => parcela.comissao) parcelas!: ParcelaComissao[];
}
