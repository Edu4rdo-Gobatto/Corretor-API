import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Imovel } from '../imoveis/imovel.entity';

abstract class CadastroNomeado extends Auditoria {
  @PrimaryGeneratedColumn('uuid') id!: string;
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

@Entity('imoveis_caracteristicas')
export class ImovelCaracteristica extends Auditoria {
  @PrimaryColumn('uuid') imovel_id!: string;
  @PrimaryColumn('uuid') caracteristica_id!: string;
  @Column({ type: 'text', nullable: true }) valor!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
  @ManyToOne(() => Imovel, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'imovel_id' }) imovel!: Relation<Imovel>;
  @ManyToOne(() => Caracteristica, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'caracteristica_id' }) caracteristica!: Relation<Caracteristica>;
}
