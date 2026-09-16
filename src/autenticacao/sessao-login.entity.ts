import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { Corretor } from '../corretores/corretor.entity';

@Entity('sessoes_login')
export class SessaoLogin extends Auditoria {
  @PrimaryColumn({ type: 'text' }) token_hash!: string;
  @Column({ type: 'integer' }) corretor_id!: number;
  @ManyToOne(() => Corretor, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'corretor_id' }) corretor!: Relation<Corretor>;
  @Column({ type: 'timestamptz' }) expira_em!: Date;
}
