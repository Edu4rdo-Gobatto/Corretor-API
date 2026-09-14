import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { ParteLocacao } from './parte-locacao.entity';

@Entity('contrato')
export class Contrato extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) numero_contrato!: string;
  @Column({ type: 'uuid' }) imovel_id!: string;
  @ManyToOne(() => Imovel, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'imovel_id' }) imovel!: Imovel;
  @Column({ type: 'uuid' }) locador_id!: string;
  @ManyToOne(() => ParteLocacao, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'locador_id' }) locador!: ParteLocacao;
  @Column({ type: 'uuid' }) locatario_id!: string;
  @ManyToOne(() => ParteLocacao, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'locatario_id' }) locatario!: ParteLocacao;
  @Column({ type: 'uuid' }) corretor_id!: string;
  @ManyToOne(() => Corretor, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'corretor_id' }) corretor!: Corretor;
  @Column({ type: 'date' }) data_inicio!: string;
  @Column({ type: 'date' }) data_fim!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) valor_aluguel!: string;
  @Column({ type: 'int' }) dia_vencimento!: number;
  @Column({ type: 'numeric', precision: 5, scale: 2 }) taxa_administracao!: string;
  @Column({ type: 'text' }) garantia_locaticia!: string;
  @Column({ type: 'text' }) indice_reajuste!: string;
  @Column({ type: 'text' }) cobranca_iptu_condominio!: string;
  @Column({ type: 'text', nullable: true }) url_pasta_drive!: string | null;
  @Column({ type: 'text', default: 'PENDENTE' }) status_pasta_drive!: 'PENDENTE' | 'CRIADA' | 'FALHOU';
  @Column({ type: 'enum', enum: ['ATIVO', 'INATIVO'], enumName: 'status_contrato', default: 'ATIVO' }) status!: 'ATIVO' | 'INATIVO';
  @Column({ type: 'text', nullable: true }) observacoes!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}
