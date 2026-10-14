import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';

abstract class CadastroContrato extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text' }) nome!: string;
  /** Chave de unicidade: sem acento, minúsculas e espaços simples, inclusive entre inativos. */
  @Column({ type: 'text', unique: true, select: false }) nome_normalizado!: string;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}

@Entity('indices_reajuste')
export class IndiceReajuste extends CadastroContrato {
  @Column({ type: 'int' }) periodicidade_meses!: number;
  @Column({ type: 'text', nullable: true }) regra!: string | null;
}

@Entity('tipos_contrato')
export class TipoContrato extends CadastroContrato {
  @Column({ type: 'text', nullable: true }) descricao!: string | null;
}
