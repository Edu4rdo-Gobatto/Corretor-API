import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { Caracteristica, FinalidadeImovel, ImovelCaracteristica, TipoImovel } from '../cadastros/cadastros.entity';
import { gerar_slug } from '../cadastros/cadastros.service';
import { Corretor } from '../corretores/corretor.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { escaparBusca } from '../comum/validacao';
import { ImovelMidia } from '../midias/imovel-midia.entity';
import { Pessoa } from '../pessoas/pessoa.entity';
import { AtualizarImovelDto, CaracteristicaImovelDto, ConsultaImoveisDto, ConsultaInternaImoveisDto, CriarImovelDto } from './imoveis.dto';
import { Imovel, StatusImovel } from './imovel.entity';
import { resposta_imovel, resposta_imovel_publico } from './imoveis.resposta';

const RESTRICAO_PUBLICA = 'imovel.ativo = true AND imovel.status = :disponivel AND corretor.ativo = true';
const PRECO_PADRAO = 'COALESCE(imovel.valor_venda, imovel.valor_locacao)';
const definidos = <T extends object>(objeto: T) => Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined)) as Partial<T>;

@Injectable()
export class ImoveisService {
  constructor(
    @InjectRepository(Imovel) private readonly imoveis: Repository<Imovel>,
    @InjectRepository(ImovelMidia) private readonly midias: Repository<ImovelMidia>,
    @InjectRepository(ImovelCaracteristica) private readonly caracteristicas: Repository<ImovelCaracteristica>,
  ) {}

  listar_publicos(consulta: ConsultaImoveisDto) { return this.listar(consulta, false); }

  listar_internos(consulta: ConsultaInternaImoveisDto) { return this.listar(consulta, true); }

  /** O slug termina no id; o título pode mudar sem quebrar links antigos. */
  async encontrar_publico(slug: string) {
    if (!/^[a-z0-9-]{1,240}$/.test(slug)) throw new BadRequestException('Slug inválido.');
    const id = Number(slug.match(/(?:^|-)(\d+)$/)?.[1]);
    if (!Number.isInteger(id) || id < 1) throw new NotFoundException('Imóvel não encontrado.');
    return resposta_imovel_publico(await this.encontrar({ id, ativo: true, status: StatusImovel.DISPONIVEL, corretor: { ativo: true } }));
  }

  async encontrar_interno(id: number) { return resposta_imovel(await this.encontrar({ id }, true)); }

  async criar(dto: CriarImovelDto, usuario: UsuarioAutenticado) {
    this.validar_areas(dto.area_util, dto.area_total);
    let id = 0;
    await this.imoveis.manager.transaction(async (gerenciador) => {
      await this.validar_referencias(gerenciador, dto, usuario);
      const { caracteristicas, ...campos } = dto;
      const repositorio = gerenciador.getRepository(Imovel);
      id = await this.proximo_id(gerenciador);
      await repositorio.save(repositorio.create({
        ...definidos(campos), id, slug: this.slug(dto.titulo, id), corretor_id: dto.corretor_id ?? usuario.id,
        status: dto.status ?? StatusImovel.DISPONIVEL, ativo: dto.ativo ?? true, destaque: dto.destaque ?? false, exclusividade: dto.exclusividade ?? false,
        criado_por: usuario.id, alterado_por: usuario.id,
      }));
      if (caracteristicas) await this.salvar_caracteristicas(gerenciador, id, caracteristicas, usuario);
    });
    return this.encontrar_interno(id);
  }

  async atualizar(id: number, dto: AtualizarImovelDto, usuario: UsuarioAutenticado) {
    await this.imoveis.manager.transaction(async (gerenciador) => {
      const repositorio = gerenciador.getRepository(Imovel);
      const imovel = await repositorio.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
      this.verificar_edicao(imovel, usuario);
      this.validar_areas(dto.area_util ?? imovel.area_util, dto.area_total ?? imovel.area_total);
      await this.validar_referencias(gerenciador, dto, usuario);
      const { caracteristicas, ...campos } = dto;
      const titulo_anterior = imovel.titulo;
      Object.assign(imovel, definidos(campos), { alterado_por: usuario.id });
      if (imovel.titulo !== titulo_anterior) imovel.slug = this.slug(imovel.titulo, id);
      await repositorio.save(imovel);
      if (caracteristicas !== undefined) await this.salvar_caracteristicas(gerenciador, id, caracteristicas, usuario);
    });
    return this.encontrar_interno(id);
  }

  async desativar(id: number, usuario: UsuarioAutenticado): Promise<void> { await this.atualizar(id, { ativo: false }, usuario); }

  verificar_edicao(imovel: Imovel, usuario: UsuarioAutenticado): void {
    if (usuario.cargo !== 'ADMIN' && imovel.corretor_id !== usuario.id) throw new ForbiddenException('Somente o corretor responsável ou ADMIN pode alterar este imóvel.');
  }

  private slug(titulo: string, id: number): string { return `${gerar_slug(titulo) || 'imovel'}-${id}`; }

  private async proximo_id(gerenciador: EntityManager): Promise<number> {
    const [linha]: [{ id: string | number }] = await gerenciador.query("SELECT nextval(pg_get_serial_sequence('imoveis', 'id')) AS id");
    return Number(linha.id);
  }

  /** Com finalidade de venda ou de locação o preço é a coluna correspondente; sem filtro, o primeiro valor informado. */
  private async coluna_preco(finalidade_id?: number): Promise<string> {
    if (!finalidade_id) return PRECO_PADRAO;
    const finalidade = await this.imoveis.manager.getRepository(FinalidadeImovel).findOneBy({ id: finalidade_id });
    const slug = finalidade?.slug ?? '';
    if (slug.includes('venda') && !slug.includes('loca')) return 'imovel.valor_venda';
    if (slug.includes('loca') && !slug.includes('venda')) return 'imovel.valor_locacao';
    return PRECO_PADRAO;
  }

  private async listar(consulta: ConsultaInternaImoveisDto, interno: boolean) {
    if (consulta.valor_min !== undefined && consulta.valor_max !== undefined && Number(consulta.valor_min) > Number(consulta.valor_max)) throw new BadRequestException('valor_min deve ser menor ou igual a valor_max.');
    if (consulta.area_min !== undefined && consulta.area_max !== undefined && Number(consulta.area_min) > Number(consulta.area_max)) throw new BadRequestException('area_min deve ser menor ou igual a area_max.');
    const preco = await this.coluna_preco(consulta.finalidade_id);
    const base = this.imoveis.createQueryBuilder('imovel').innerJoin('imovel.corretor', 'corretor');
    if (interno) {
      if (consulta.id) base.andWhere('imovel.id = :id', { id: consulta.id });
      if (consulta.ativo !== undefined) base.andWhere('imovel.ativo = :ativo', { ativo: consulta.ativo });
      if (consulta.status) base.andWhere('imovel.status = :status', { status: consulta.status });
      if (consulta.corretor_id) base.andWhere('imovel.corretor_id = :corretor', { corretor: consulta.corretor_id });
      if (consulta.proprietario_id) base.andWhere('imovel.proprietario_id = :proprietario', { proprietario: consulta.proprietario_id });
    } else {
      base.andWhere(RESTRICAO_PUBLICA, { disponivel: StatusImovel.DISPONIVEL });
    }
    if (consulta.tipo_id) base.andWhere('imovel.tipo_id = :tipo', { tipo: consulta.tipo_id });
    if (consulta.finalidade_id) base.andWhere('imovel.finalidade_id = :finalidade', { finalidade: consulta.finalidade_id });
    if (consulta.cidade) base.andWhere('imovel.cidade ILIKE :cidade', { cidade: escaparBusca(consulta.cidade) });
    if (consulta.bairro) base.andWhere('imovel.bairro ILIKE :bairro', { bairro: `%${escaparBusca(consulta.bairro)}%` });
    if (consulta.destaque !== undefined) base.andWhere('imovel.destaque = :destaque', { destaque: consulta.destaque });
    if (consulta.busca) {
      if (/^#?\d{1,10}$/.test(consulta.busca)) base.andWhere('imovel.id = :busca_id', { busca_id: Number(consulta.busca.replace('#', '')) });
      else base.andWhere('(imovel.titulo ILIKE :termo OR imovel.bairro ILIKE :termo OR imovel.cidade ILIKE :termo OR imovel.descricao ILIKE :termo)', { termo: `%${escaparBusca(consulta.busca)}%` });
    }
    if (consulta.valor_min !== undefined) base.andWhere(`${preco} >= :valor_min`, { valor_min: consulta.valor_min });
    if (consulta.valor_max !== undefined) base.andWhere(`${preco} <= :valor_max`, { valor_max: consulta.valor_max });
    if (consulta.area_min !== undefined) base.andWhere('imovel.area_util >= :area_min', { area_min: consulta.area_min });
    if (consulta.area_max !== undefined) base.andWhere('imovel.area_util <= :area_max', { area_max: consulta.area_max });
    const total = await base.clone().getCount();
    const ordenado = base.clone().select('imovel.id', 'id');
    switch (consulta.ordenar) {
      case 'valor_asc': ordenado.orderBy(preco, 'ASC', 'NULLS LAST'); break;
      case 'valor_desc': ordenado.orderBy(preco, 'DESC', 'NULLS LAST'); break;
      case 'area_asc': ordenado.orderBy('imovel.area_util', 'ASC'); break;
      case 'area_desc': ordenado.orderBy('imovel.area_util', 'DESC'); break;
      default: ordenado.orderBy('imovel.criado_em', 'DESC');
    }
    const linhas = await ordenado.addOrderBy('imovel.id', 'DESC').offset((consulta.pagina - 1) * consulta.limite).limit(consulta.limite).getRawMany<{ id: number | string }>();
    const ids = linhas.map((linha) => Number(linha.id));
    const itens = ids.length ? await this.imoveis.find({ where: { id: In(ids) }, relations: { corretor: true, tipo: true, finalidade: true, proprietario: interno } }) : [];
    itens.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    if (itens.length) {
      const [midias, caracteristicas] = await Promise.all([
        this.midias.find({ where: { imovel_id: In(ids) }, order: { ordem: 'ASC', id: 'ASC' } }),
        this.caracteristicas.find({ where: { imovel_id: In(ids), ativo: true, caracteristica: { ativo: true } }, relations: { caracteristica: true } }),
      ]);
      for (const imovel of itens) { imovel.midias = midias.filter((midia) => midia.imovel_id === imovel.id); imovel.caracteristicas = caracteristicas.filter((vinculo) => vinculo.imovel_id === imovel.id); }
    }
    return { itens: itens.map(interno ? resposta_imovel : resposta_imovel_publico), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  private async encontrar(where: FindOptionsWhere<Imovel>, interno = false) {
    const imovel = await this.imoveis.findOne({ where, relations: { corretor: true, tipo: true, finalidade: true, midias: true, caracteristicas: { caracteristica: true }, proprietario: interno } });
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
    return imovel;
  }

  private validar_areas(util: string, total: string) {
    if (Number(util) <= 0 || Number(total) < Number(util)) throw new BadRequestException('Área útil deve ser positiva e não pode superar a área total.');
  }

  private async validar_referencias(gerenciador: EntityManager, dto: AtualizarImovelDto, usuario: UsuarioAutenticado) {
    const lock = { mode: 'pessimistic_read' as const };
    if (dto.tipo_id && !await gerenciador.getRepository(TipoImovel).findOne({ where: { id: dto.tipo_id, ativo: true }, lock })) throw new BadRequestException('Tipo de imóvel ativo não encontrado.');
    if (dto.finalidade_id && !await gerenciador.getRepository(FinalidadeImovel).findOne({ where: { id: dto.finalidade_id, ativo: true }, lock })) throw new BadRequestException('Finalidade ativa não encontrada.');
    if (dto.proprietario_id && !await gerenciador.getRepository(Pessoa).findOne({ where: { id: dto.proprietario_id, ativo: true }, lock })) throw new BadRequestException('Proprietário ativo não encontrado.');
    if (dto.corretor_id && usuario.cargo !== 'ADMIN' && dto.corretor_id !== usuario.id) throw new ForbiddenException('Somente ADMIN pode atribuir imóvel a outro corretor.');
    const corretor_id = dto.corretor_id ?? usuario.id;
    if (!await gerenciador.getRepository(Corretor).findOne({ where: { id: corretor_id, ativo: true }, lock })) throw new BadRequestException('Corretor ativo não encontrado.');
  }

  private async salvar_caracteristicas(gerenciador: EntityManager, id: number, dados: CaracteristicaImovelDto[], usuario: UsuarioAutenticado) {
    const ids = dados.map((item) => item.caracteristica_id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Características duplicadas.');
    if (ids.length) {
      const encontradas = await gerenciador.getRepository(Caracteristica).find({ where: { id: In(ids), ativo: true }, lock: { mode: 'pessimistic_read' } });
      if (encontradas.length !== ids.length) throw new BadRequestException('Uma ou mais características estão inativas ou não existem.');
    }
    const repositorio = gerenciador.getRepository(ImovelCaracteristica);
    const anteriores = await repositorio.findBy({ imovel_id: id });
    await repositorio.update({ imovel_id: id }, { ativo: false, alterado_por: usuario.id });
    if (dados.length) await repositorio.save(dados.map((item) => repositorio.create({
      ...(anteriores.find((vinculo) => vinculo.caracteristica_id === item.caracteristica_id) ?? { criado_por: usuario.id }),
      imovel_id: id, caracteristica_id: item.caracteristica_id, valor: item.valor ?? null, ativo: true, alterado_por: usuario.id,
    })));
  }
}
