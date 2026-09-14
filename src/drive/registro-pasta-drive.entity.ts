import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';

@Entity('pastas_drive')
export class RegistroPastaDrive extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) chave!: string;
  @Column({ type: 'text', unique: true }) id_drive!: string;
  @Column({ type: 'text' }) pasta_pai_id!: string;
  @Column({ type: 'text' }) nome!: string;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}
