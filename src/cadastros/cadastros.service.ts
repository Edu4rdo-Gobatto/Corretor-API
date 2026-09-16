import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Caracteristica, FinalidadeImovel, TipoImovel } from './cadastros.entity';
import { ConsultaCadastrosDto, CriarCadastroDto, CriarCaracteristicaDto } from './cadastros.dto';

export type CategoriaCadastro = 'tipos-imovel' | 'finalidades-imovel' | 'caracteristicas';
type Registro = TipoImovel | FinalidadeImovel | Caracteristica;
type DadosCadastro = Partial<CriarCadastroDto & CriarCaracteristicaDto>;

export function gerar_slug(titulo: string): string {
  return titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}

@Injectable()
export class CadastrosService {
  constructor(
    @InjectRepository(TipoImovel) private readonly tipos: Repository<TipoImovel>,
    @InjectRepository(FinalidadeImovel) private readonly finalidades: Repository<FinalidadeImovel>,
    @InjectRepository(Caracteristica) private readonly caracteristicas: Repository<Caracteristica>,
  ) {}

  async listar(categoria: CategoriaCadastro, consulta: ConsultaCadastrosDto, publico = false) {
    const where: FindOptionsWhere<Registro> = publico ? { ativo: true } : {};
    if (consulta.busca?.trim()) where.nome = ILike(`%${consulta.busca.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const [itens, total] = await this.repositorio(categoria).findAndCount({ where, order: { nome: 'ASC', id: 'ASC' }, take: consulta.limite, skip: (consulta.pagina - 1) * consulta.limite });
    return { itens: itens.map((item) => this.resposta(item)), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  async encontrar(categoria: CategoriaCadastro, id: number) {
    const item = await this.repositorio(categoria).findOneBy({ id });
    if (!item) throw new NotFoundException('Cadastro não encontrado.');
    return this.resposta(item);
  }

  async criar(categoria: CategoriaCadastro, dados: DadosCadastro, usuario: UsuarioAutenticado) {
    const repositorio = this.repositorio(categoria);
    const slug = categoria === 'caracteristicas' ? undefined : dados.slug ?? gerar_slug(dados.nome ?? '');
    if (slug === '') throw new BadRequestException('Informe um slug válido para este nome.');
    const item = repositorio.create({ ...dados, ...(slug !== undefined ? { slug } : {}), ativo: dados.ativo ?? true, criado_por: usuario.id, alterado_por: usuario.id });
    return this.salvar(repositorio, item);
  }

  async atualizar(categoria: CategoriaCadastro, id: number, dados: DadosCadastro, usuario: UsuarioAutenticado) {
    const repositorio = this.repositorio(categoria);
    const item = await repositorio.findOneBy({ id });
    if (!item) throw new NotFoundException('Cadastro não encontrado.');
    Object.assign(item, Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined)), { alterado_por: usuario.id });
    return this.salvar(repositorio, item);
  }

  private async salvar(repositorio: Repository<Registro>, item: Registro) {
    try { return this.resposta(await repositorio.save(item)); }
    catch (erro) {
      if (typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === '23505') throw new ConflictException('Nome ou slug já cadastrado, inclusive entre registros inativos.');
      throw erro;
    }
  }

  private repositorio(categoria: CategoriaCadastro): Repository<Registro> {
    const repositorios = { 'tipos-imovel': this.tipos, 'finalidades-imovel': this.finalidades, caracteristicas: this.caracteristicas };
    return repositorios[categoria] as Repository<Registro>;
  }

  private resposta(item: Registro) {
    return { id: item.id, nome: item.nome, ativo: item.ativo, ...('slug' in item ? { slug: item.slug } : { icone: item.icone }), criado_em: item.criado_em, alterado_em: item.alterado_em };
  }
}
