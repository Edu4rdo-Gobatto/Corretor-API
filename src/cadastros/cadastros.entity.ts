import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Imovel } from '../imoveis/imovel.entity';

abstract class CadastroNomeado extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text', unique: true }) nome!: string;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}

@Entity('tipos_imovel')
export class TipoImovel extends CadastroNomeado {
  @Column({ type: 'text', unique: true }) slug!: string;
}

@Entity('finalidades_imovel')
export class FinalidadeImovel extends CadastroNomeado {
  @Column({ type: 'text', unique: true }) slug!: string;
}

@Entity('caracteristicas')
export class Caracteristica extends CadastroNomeado {
  @Column({ type: 'text', nullable: true }) icone!: string | null;
}

/**
 * Cidades atendidas: alimentam o formulário do imóvel (Estado → Cidade) e o filtro do catálogo. A unicidade é por
 * `nome_normalizado` + `estado` (migration `1789862400000`), então a mesma cidade pode existir em dois estados.
 * O imóvel guarda o nome em texto (`imoveis.cidade`), sem chave estrangeira.
 */
@Entity('cidades')
export class Cidade extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text' }) nome!: string;
  @Column({ type: 'text', select: false }) nome_normalizado!: string;
  @Column({ type: 'char', length: 2 }) estado!: string;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}

@Entity('imoveis_caracteristicas')
export class ImovelCaracteristica extends Auditoria {
  @PrimaryColumn({ type: 'integer' }) imovel_id!: number;
  @PrimaryColumn({ type: 'integer' }) caracteristica_id!: number;
  @Column({ type: 'text', nullable: true }) valor!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
  @ManyToOne(() => Imovel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel>;
  @ManyToOne(() => Caracteristica, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'caracteristica_id' }) caracteristica!: Relation<Caracteristica>;
}
