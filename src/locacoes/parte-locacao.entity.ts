import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';

export type PapelParteLocacao = 'LOCADOR' | 'LOCATARIO';
@Entity('partes_locacao')
export class ParteLocacao extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'enum', enum: ['LOCADOR', 'LOCATARIO'], enumName: 'papel_parte_locacao' }) papel!: PapelParteLocacao;
  @Column({ type: 'enum', enum: ['PF', 'PJ'], enumName: 'tipo_pessoa' }) tipo_pessoa!: 'PF' | 'PJ';
  @Index() @Column({ type: 'text' }) nome!: string;
  @Index() @Column({ type: 'text' }) cpf_cnpj!: string;
  @Column({ type: 'text', nullable: true }) email!: string | null;
  @Column({ type: 'text', nullable: true }) telefone!: string | null;
  @Column({ type: 'text', nullable: true }) endereco!: string | null;
  @Column({ type: 'date', nullable: true }) data_nascimento!: string | null;
  @Column({ type: 'text', nullable: true }) banco_nome!: string | null;
  @Column({ type: 'text', nullable: true }) banco_agencia!: string | null;
  @Column({ type: 'text', nullable: true }) banco_conta!: string | null;
  @Column({ type: 'text', nullable: true }) chave_pix!: string | null;
  @Column({ type: 'text', nullable: true }) observacoes!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}
