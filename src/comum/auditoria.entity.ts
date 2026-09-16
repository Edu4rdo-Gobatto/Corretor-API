import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class Auditoria {
  @CreateDateColumn({ type: 'timestamptz' }) criado_em!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) alterado_em!: Date;
  @Column({ type: 'integer', nullable: true }) criado_por!: number | null;
  @Column({ type: 'integer', nullable: true }) alterado_por!: number | null;
}
