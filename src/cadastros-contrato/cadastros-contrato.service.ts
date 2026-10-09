import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { ConsultaCadastrosDto } from '../cadastros/cadastros.dto';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { escaparBusca } from '../comum/validacao';
import { CriarIndiceReajusteDto, CriarTipoContratoDto } from './cadastros-contrato.dto';
import { IndiceReajuste, TipoContrato } from './cadastros-contrato.entity';

export type CategoriaContrato = 'indices-reajuste' | 'tipos-contrato';
type Registro = IndiceReajuste | TipoContrato;
type Dados = Partial<CriarIndiceReajusteDto & CriarTipoContratoDto>;

export const normalizarNome = (nome: string): string =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

@Injectable()
export class CadastrosContratoService {
  constructor(
    @InjectRepository(IndiceReajuste) private readonly indices: Repository<IndiceReajuste>,
    @InjectRepository(TipoContrato) private readonly tipos: Repository<TipoContrato>,
  ) {}

  async listar(categoria: CategoriaContrato, consulta: ConsultaCadastrosDto, somenteAtivos = false) {
    const where: FindOptionsWhere<Registro> = somenteAtivos ? { ativo: true } : {};
    if (consulta.busca?.trim()) where.nome = ILike(`%${escaparBusca(consulta.busca.trim())}%`);
    const [itens, total] = await this.repositorio(categoria).findAndCount({ where, order: { nome: 'ASC', id: 'ASC' }, take: consulta.limite, skip: (consulta.pagina - 1) * consulta.limite });
    return { itens, total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  async encontrar(categoria: CategoriaContrato, id: number) {
    const item = await this.repositorio(categoria).findOneBy({ id });
    if (!item) throw new NotFoundException('Cadastro não encontrado.');
    return item;
  }

  criar(categoria: CategoriaContrato, dados: Dados, usuario: UsuarioAutenticado) {
    const repositorio = this.repositorio(categoria);
    return this.salvar(repositorio, repositorio.create({ ...dados, ativo: dados.ativo ?? true, criado_por: usuario.id, alterado_por: usuario.id }));
  }

  async atualizar(categoria: CategoriaContrato, id: number, dados: Dados, usuario: UsuarioAutenticado) {
    const repositorio = this.repositorio(categoria);
    const item = await repositorio.findOneBy({ id });
    if (!item) throw new NotFoundException('Cadastro não encontrado.');
    Object.assign(item, Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined)), { alterado_por: usuario.id });
    return this.salvar(repositorio, item);
  }

  private async salvar(repositorio: Repository<Registro>, item: Registro) {
    item.nome_normalizado = normalizarNome(item.nome);
    try {
      const salvo = await repositorio.save(item);
      return repositorio.findOneByOrFail({ id: salvo.id });
    } catch (erro) {
      if (typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === '23505') {
        throw new ConflictException('Já existe um cadastro com este nome (ignorando acentos e maiúsculas), inclusive entre os inativos. Reative o existente.');
      }
      throw erro;
    }
  }

  private repositorio(categoria: CategoriaContrato): Repository<Registro> {
    return (categoria === 'indices-reajuste' ? this.indices : this.tipos) as Repository<Registro>;
  }
}
