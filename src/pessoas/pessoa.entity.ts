import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';
import { Imovel } from '../imoveis/imovel.entity';

export enum OrigemPessoa { SITE = 'SITE', MANUAL = 'MANUAL' }
export enum StatusContato { PENDENTE = 'PENDENTE', RESPONDIDO = 'RESPONDIDO', FINALIZADO = 'FINALIZADO' }
export type TipoPessoa = 'PF' | 'PJ';

/** Cadastro único: o lead do site, o cliente, o proprietário e o inquilino são a mesma pessoa. */
@Entity('pessoas')
@Index('idx_pessoas_corretor', ['corretor_id', 'criado_em', 'id'])
@Index('idx_pessoas_imovel', ['imovel_id'])
@Index('idx_pessoas_status', ['status_contato'])
export class Pessoa extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text' }) nome!: string;
  @Column({ type: 'text', nullable: true }) telefone!: string | null;
  @Column({ type: 'text', nullable: true }) email!: string | null;
  @Column({ type: 'enum', enum: ['PF', 'PJ'], enumName: 'tipo_pessoa', nullable: true }) tipo_pessoa!: TipoPessoa | null;
  @Column({ type: 'text', nullable: true }) cpf_cnpj!: string | null;
  @Column({ type: 'date', nullable: true }) data_nascimento!: string | null;
  @Column({ type: 'text', nullable: true }) endereco!: string | null;
  @Column({ type: 'text', nullable: true }) banco_nome!: string | null;
  @Column({ type: 'text', nullable: true }) banco_agencia!: string | null;
  @Column({ type: 'text', nullable: true }) banco_conta!: string | null;
  @Column({ type: 'text', nullable: true }) chave_pix!: string | null;
  @Column({ type: 'text', nullable: true }) observacoes!: string | null;
  @Column({ type: 'text', nullable: true }) mensagem!: string | null;
  @Column({ type: 'integer', nullable: true }) imovel_id!: number | null;
  @ManyToOne(() => Imovel, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel> | null;
  @Column({ type: 'integer' }) corretor_id!: number;
  @ManyToOne(() => Corretor, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'corretor_id' }) corretor!: Relation<Corretor>;
  @Column({ type: 'enum', enum: OrigemPessoa, enumName: 'origem_pessoa', default: OrigemPessoa.MANUAL }) origem!: OrigemPessoa;
  @Column({ type: 'enum', enum: StatusContato, enumName: 'status_contato', default: StatusContato.PENDENTE }) status_contato!: StatusContato;
  @Column({ type: 'boolean', default: false }) consentimento!: boolean;
  @Column({ type: 'text', nullable: true, select: false }) consentimento_ip!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) consentimento_em!: Date | null;
  @Column({ type: 'text', nullable: true }) versao_termos!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}

/** Resposta sem o IP do consentimento, que fica só no banco para auditoria. */
export function resposta_pessoa(pessoa: Pessoa) {
  return {
    id: pessoa.id, nome: pessoa.nome, telefone: pessoa.telefone, email: pessoa.email, tipo_pessoa: pessoa.tipo_pessoa,
    cpf_cnpj: pessoa.cpf_cnpj, data_nascimento: pessoa.data_nascimento, endereco: pessoa.endereco,
    banco_nome: pessoa.banco_nome, banco_agencia: pessoa.banco_agencia, banco_conta: pessoa.banco_conta, chave_pix: pessoa.chave_pix,
    observacoes: pessoa.observacoes, mensagem: pessoa.mensagem, imovel_id: pessoa.imovel_id, corretor_id: pessoa.corretor_id,
    origem: pessoa.origem, status_contato: pessoa.status_contato, consentimento: pessoa.consentimento,
    consentimento_em: pessoa.consentimento_em, versao_termos: pessoa.versao_termos, ativo: pessoa.ativo,
    criado_em: pessoa.criado_em, alterado_em: pessoa.alterado_em,
  };
}
