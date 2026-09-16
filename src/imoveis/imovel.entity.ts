import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';
import { FinalidadeImovel, ImovelCaracteristica, TipoImovel } from '../cadastros/cadastros.entity';
import { ImovelMidia } from '../midias/imovel-midia.entity';
import { Pessoa } from '../pessoas/pessoa.entity';

export enum StatusImovel { DISPONIVEL = 'DISPONIVEL', RESERVADO = 'RESERVADO', VENDIDO = 'VENDIDO', ALUGADO = 'ALUGADO', RETIRADO = 'RETIRADO' }

@Entity('imoveis')
@Index('idx_imoveis_corretor', ['corretor_id'])
@Index('idx_imoveis_publico', ['ativo', 'status', 'criado_em'])
@Index('idx_imoveis_proprietario', ['proprietario_id'])
@Check('chk_imoveis_areas', 'area_util > 0 AND area_total >= area_util')
@Check('chk_imoveis_valores', '(valor_venda IS NULL OR valor_venda >= 0) AND (valor_locacao IS NULL OR valor_locacao >= 0) AND (valor_condominio IS NULL OR valor_condominio >= 0) AND (valor_iptu IS NULL OR valor_iptu >= 0)')
export class Imovel extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text' }) titulo!: string;
  @Column({ type: 'text', unique: true }) slug!: string;
  @Column({ type: 'integer' }) tipo_id!: number;
  @Column({ type: 'integer' }) finalidade_id!: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true }) valor_venda!: string | null;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true }) valor_locacao!: string | null;
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
  @Column({ type: 'boolean', default: false }) destaque!: boolean;
  @Column({ type: 'integer' }) corretor_id!: number;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
  // Ficha interna: nunca sai nas rotas públicas.
  @Column({ type: 'integer', nullable: true }) proprietario_id!: number | null;
  @Column({ type: 'boolean', default: false }) exclusividade!: boolean;
  @Column({ type: 'date', nullable: true }) exclusividade_ate!: string | null;
  @Column({ type: 'date', nullable: true }) data_captacao!: string | null;
  @Column({ type: 'text', nullable: true }) chaves!: string | null;
  @Column({ type: 'text', nullable: true }) matricula!: string | null;
  @Column({ type: 'text', nullable: true }) inscricao_municipal!: string | null;
  @Column({ type: 'text', nullable: true }) observacoes_internas!: string | null;
  @Column({ type: 'text', nullable: true }) motivo_baixa!: string | null;
  @ManyToOne(() => TipoImovel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tipo_id' }) tipo!: Relation<TipoImovel>;
  @ManyToOne(() => FinalidadeImovel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'finalidade_id' }) finalidade!: Relation<FinalidadeImovel>;
  @ManyToOne(() => Corretor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'corretor_id' }) corretor!: Relation<Corretor>;
  @ManyToOne(() => Pessoa, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'proprietario_id' }) proprietario!: Relation<Pessoa> | null;
  @OneToMany(() => ImovelMidia, (midia) => midia.imovel) midias!: Relation<ImovelMidia[]>;
  @OneToMany(() => ImovelCaracteristica, (vinculo) => vinculo.imovel) caracteristicas!: Relation<ImovelCaracteristica[]>;
}
