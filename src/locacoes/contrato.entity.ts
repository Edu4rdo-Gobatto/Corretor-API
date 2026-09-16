import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Pessoa } from '../pessoas/pessoa.entity';

@Entity('contrato')
export class Contrato extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text', unique: true }) numero_contrato!: string;
  @Column({ type: 'integer' }) imovel_id!: number;
  @ManyToOne(() => Imovel, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel>;
  @Column({ type: 'integer' }) locador_id!: number;
  @ManyToOne(() => Pessoa, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'locador_id' }) locador!: Relation<Pessoa>;
  @Column({ type: 'integer' }) locatario_id!: number;
  @ManyToOne(() => Pessoa, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'locatario_id' }) locatario!: Relation<Pessoa>;
  @Column({ type: 'integer' }) corretor_id!: number;
  @ManyToOne(() => Corretor, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'corretor_id' }) corretor!: Relation<Corretor>;
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

/** Contrato com os nomes das partes e do imóvel, sem expor o cadastro completo das pessoas. */
export function resposta_contrato(contrato: Contrato) {
  return {
    id: contrato.id, numero_contrato: contrato.numero_contrato, imovel_id: contrato.imovel_id, locador_id: contrato.locador_id,
    locatario_id: contrato.locatario_id, corretor_id: contrato.corretor_id, data_inicio: contrato.data_inicio, data_fim: contrato.data_fim,
    valor_aluguel: contrato.valor_aluguel, dia_vencimento: contrato.dia_vencimento, taxa_administracao: contrato.taxa_administracao,
    garantia_locaticia: contrato.garantia_locaticia, indice_reajuste: contrato.indice_reajuste, cobranca_iptu_condominio: contrato.cobranca_iptu_condominio,
    url_pasta_drive: contrato.url_pasta_drive, status_pasta_drive: contrato.status_pasta_drive, status: contrato.status,
    observacoes: contrato.observacoes, ativo: contrato.ativo, criado_em: contrato.criado_em, alterado_em: contrato.alterado_em,
    imovel_titulo: contrato.imovel?.titulo ?? null, locador_nome: contrato.locador?.nome ?? null, locatario_nome: contrato.locatario?.nome ?? null,
  };
}
