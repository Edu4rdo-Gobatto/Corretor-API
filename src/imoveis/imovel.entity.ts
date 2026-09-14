import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';
import { FinalidadeImovel, ImovelCaracteristica, TipoImovel } from '../cadastros/cadastros.entity';
import { ImovelMidia } from '../midias/imovel-midia.entity';

export enum StatusImovel { DISPONIVEL = 'DISPONIVEL', RESERVADO = 'RESERVADO', CONCLUIDO = 'CONCLUIDO' }

@Entity('imoveis')
@Index('idx_imoveis_corretor', ['corretor_id'])
@Index('idx_imoveis_publico', ['ativo', 'status', 'criado_em'])
@Check('chk_imoveis_areas', 'area_util > 0 AND area_total >= area_util')
@Check('chk_imoveis_valores', 'valor >= 0 AND (valor_condominio IS NULL OR valor_condominio >= 0) AND (valor_iptu IS NULL OR valor_iptu >= 0)')
export class Imovel extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text' }) titulo!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column('uuid') tipo_id!: string;
  @Column('uuid') finalidade_id!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) valor!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) valor_condominio!: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) valor_iptu!: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) area_util!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) area_total!: string;
  @Column({ type: 'text', nullable: true }) cep!: string | null;
  @Column('text') logradouro!: string;
  @Column('text') numero!: string;
  @Column({ type: 'text', nullable: true }) complemento!: string | null;
  @Column('text') bairro!: string;
  @Column('text') cidade!: string;
  @Column('text') estado!: string;
  @Column('text') descricao!: string;
  @Column({ type: 'enum', enum: StatusImovel, enumName: 'status_imovel', default: StatusImovel.DISPONIVEL }) status!: StatusImovel;
  @Column('uuid') corretor_id!: string;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
  @ManyToOne(() => TipoImovel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tipo_id' }) tipo!: Relation<TipoImovel>;
  @ManyToOne(() => FinalidadeImovel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'finalidade_id' }) finalidade!: Relation<FinalidadeImovel>;
  @ManyToOne(() => Corretor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'corretor_id' }) corretor!: Relation<Corretor>;
  @OneToMany(() => ImovelMidia, (midia) => midia.imovel) midias!: Relation<ImovelMidia[]>;
  @OneToMany(() => ImovelCaracteristica, (vinculo) => vinculo.imovel) caracteristicas!: Relation<ImovelCaracteristica[]>;
}
