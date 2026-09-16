import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Imovel } from '../imoveis/imovel.entity';

export enum TipoMidia { IMAGEM = 'IMAGEM', VIDEO_EMBED = 'VIDEO_EMBED', VIDEO_ARQUIVO = 'VIDEO_ARQUIVO' }

@Entity('imoveis_midias')
@Index('idx_imoveis_midias_ordem', ['imovel_id', 'ordem'])
@Index('uq_imoveis_midias_capa', ['imovel_id'], { unique: true, where: 'capa = true' })
@Check('chk_imoveis_midias_capa', "NOT capa OR tipo = 'IMAGEM'")
@Check('chk_imoveis_midias_ordem', 'ordem >= 0')
export class ImovelMidia extends Auditoria {
  @Column({ type: 'integer', nullable: false }) declare criado_por: number;
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'integer' }) imovel_id!: number;
  @ManyToOne(() => Imovel, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel>;
  @Column({ type: 'enum', enum: TipoMidia, enumName: 'tipo_midia' }) tipo!: TipoMidia;
  @Column('text') url!: string;
  @Column({ type: 'text', nullable: true, select: false }) chave_armazenamento!: string | null;
  @Column({ type: 'integer', default: 0 }) ordem!: number;
  @Column({ type: 'boolean', default: false }) capa!: boolean;
}
