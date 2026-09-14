import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class Auditoria {
  @CreateDateColumn({ type: 'timestamptz' }) criado_em!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) alterado_em!: Date;
  @Column({ type: 'uuid', nullable: true }) criado_por!: string | null;
  @Column({ type: 'uuid', nullable: true }) alterado_por!: string | null;
}
