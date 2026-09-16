import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from '../comum/auditoria.entity';
import { CargoCorretor } from './corretores.dto';
export { CargoCorretor } from './corretores.dto';

@Entity('corretores')
export class Corretor extends Auditoria {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'text' }) nome!: string;
  @Column({ type: 'text', unique: true }) email!: string;
  @Column({ type: 'text', select: false }) senha_hash!: string;
  @Column({ type: 'text' }) cpf!: string;
  @Column({ type: 'text' }) whatsapp!: string;
  @Column({ type: 'text', nullable: true }) creci!: string | null;
  @Column({ type: 'enum', enum: CargoCorretor, enumName: 'cargo_corretor', default: CargoCorretor.CORRETOR }) cargo!: CargoCorretor;
  @Column({ type: 'text', nullable: true }) url_foto!: string | null;
  @Column({ type: 'boolean', default: true }) ativo!: boolean;
}

export function perfilCorretor(corretor: Corretor) {
  return {
    id: corretor.id, nome: corretor.nome, email: corretor.email, cpf: corretor.cpf,
    whatsapp: corretor.whatsapp, creci: corretor.creci, cargo: corretor.cargo,
    url_foto: corretor.url_foto, ativo: corretor.ativo,
    criado_em: corretor.criado_em, alterado_em: corretor.alterado_em,
    criado_por: corretor.criado_por, alterado_por: corretor.alterado_por,
  };
}
