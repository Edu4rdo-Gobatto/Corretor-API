import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Between, EntityManager, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { Caracteristica, FinalidadeImovel, ImovelCaracteristica, TipoImovel } from '../cadastros/cadastros.entity';
import { gerar_slug } from '../cadastros/cadastros.service';
import { Corretor } from '../corretores/corretor.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { ImovelMidia } from '../midias/imovel-midia.entity';
import { AtualizarImovelDto, CaracteristicaImovelDto, ConsultaImoveisDto, ConsultaInternaImoveisDto, CriarImovelDto } from './imoveis.dto';
import { Imovel, StatusImovel } from './imovel.entity';
import { resposta_imovel } from './imoveis.resposta';

@Injectable()
export class ImoveisService {
  constructor(@InjectRepository(Imovel) private readonly imoveis: Repository<Imovel>, @InjectRepository(ImovelMidia) private readonly midias: Repository<ImovelMidia>, @InjectRepository(ImovelCaracteristica) private readonly caracteristicas: Repository<ImovelCaracteristica>) {}

  listar_publicos(consulta: ConsultaImoveisDto) {
    return this.listar(consulta, { ativo: true, status: StatusImovel.DISPONIVEL, corretor: { ativo: true } });
  }

  listar_internos(consulta: ConsultaInternaImoveisDto) {
    return this.listar(consulta, { ...(consulta.ativo !== undefined ? { ativo: consulta.ativo } : {}), ...(consulta.status ? { status: consulta.status } : {}), ...(consulta.corretor_id ? { corretor_id: consulta.corretor_id } : {}) });
  }

  async encontrar_publico(slug: string) {
    if (!/^[a-z0-9-]{1,240}$/.test(slug)) throw new BadRequestException('Slug inválido.');
    return resposta_imovel(await this.encontrar({ slug, ativo: true, status: StatusImovel.DISPONIVEL, corretor: { ativo: true } }));
  }

  async encontrar_interno(id: string) { return resposta_imovel(await this.encontrar({ id })); }

  async criar(dto: CriarImovelDto, usuario: UsuarioAutenticado) {
    this.validar_areas(dto.area_util, dto.area_total);
    const id = randomUUID();
    await this.imoveis.manager.transaction(async (gerenciador) => {
      await this.validar_referencias(gerenciador, dto, usuario);
      const { caracteristicas, ...campos } = dto;
      const repositorio = gerenciador.getRepository(Imovel);
      await repositorio.save(repositorio.create({ ...campos, id, slug: `${gerar_slug(dto.titulo) || 'imovel'}-${id}`, corretor_id: dto.corretor_id ?? usuario.id,
        status: dto.status ?? StatusImovel.DISPONIVEL, ativo: dto.ativo ?? true,
        valor_condominio: dto.valor_condominio ?? null, valor_iptu: dto.valor_iptu ?? null, cep: dto.cep ?? null, complemento: dto.complemento ?? null,
        criado_por: usuario.id, alterado_por: usuario.id }));
      if (caracteristicas) await this.salvar_caracteristicas(gerenciador, id, caracteristicas, usuario);
    });
    return this.encontrar_interno(id);
  }

  async atualizar(id: string, dto: AtualizarImovelDto, usuario: UsuarioAutenticado) {
    await this.imoveis.manager.transaction(async (gerenciador) => {
      const repositorio = gerenciador.getRepository(Imovel);
      const imovel = await repositorio.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
      this.verificar_edicao(imovel, usuario);
      this.validar_areas(dto.area_util ?? imovel.area_util, dto.area_total ?? imovel.area_total);
      await this.validar_referencias(gerenciador, dto, usuario);
      const { caracteristicas, ...campos } = dto;
      Object.assign(imovel, Object.fromEntries(Object.entries(campos).filter(([, valor]) => valor !== undefined)), { alterado_por: usuario.id });
      await repositorio.save(imovel);
      if (caracteristicas !== undefined) await this.salvar_caracteristicas(gerenciador, id, caracteristicas, usuario);
    });
    return this.encontrar_interno(id);
  }

  async desativar(id: string, usuario: UsuarioAutenticado): Promise<void> { await this.atualizar(id, { ativo: false }, usuario); }

  verificar_edicao(imovel: Imovel, usuario: UsuarioAutenticado): void {
    if (usuario.cargo !== 'ADMIN' && imovel.corretor_id !== usuario.id) throw new ForbiddenException('Somente o corretor responsável ou ADMIN pode alterar este imóvel.');
  }

  private async listar(consulta: ConsultaImoveisDto, restricao: FindOptionsWhere<Imovel>) {
    if (consulta.valor_min !== undefined && consulta.valor_max !== undefined && Number(consulta.valor_min) > Number(consulta.valor_max)) throw new BadRequestException('valor_min deve ser menor ou igual a valor_max.');
    const where = { ...restricao };
    if (consulta.tipo_id) where.tipo_id = consulta.tipo_id;
    if (consulta.finalidade_id) where.finalidade_id = consulta.finalidade_id;
    if (consulta.cidade) where.cidade = ILike(consulta.cidade.trim().replace(/[\\%_]/g, '\\$&'));
    if (consulta.busca) where.titulo = ILike(`%${consulta.busca.trim().replace(/[\\%_]/g, '\\$&')}%`);
    if (consulta.valor_min !== undefined || consulta.valor_max !== undefined) where.valor = Between(consulta.valor_min ?? '0', consulta.valor_max ?? '9999999999.99');
    const [itens, total] = await this.imoveis.findAndCount({ where, relations: { corretor: true, tipo: true, finalidade: true }, order: { criado_em: 'DESC', id: 'DESC' }, skip: (consulta.pagina - 1) * consulta.limite, take: consulta.limite });
    if (itens.length) {
      const ids = In(itens.map((imovel) => imovel.id));
      const [midias, caracteristicas] = await Promise.all([
        this.midias.find({ where: { imovel_id: ids }, order: { ordem: 'ASC', id: 'ASC' } }),
        this.caracteristicas.find({ where: { imovel_id: ids, ativo: true, caracteristica: { ativo: true } }, relations: { caracteristica: true } }),
      ]);
      for (const imovel of itens) { imovel.midias = midias.filter((midia) => midia.imovel_id === imovel.id); imovel.caracteristicas = caracteristicas.filter((vinculo) => vinculo.imovel_id === imovel.id); }
    }
    return { itens: itens.map(resposta_imovel), total, pagina: consulta.pagina, limite: consulta.limite, total_paginas: Math.ceil(total / consulta.limite) };
  }

  private async encontrar(where: FindOptionsWhere<Imovel>) {
    const imovel = await this.imoveis.findOne({ where, relations: { corretor: true, tipo: true, finalidade: true, midias: true, caracteristicas: { caracteristica: true } } });
    if (!imovel) throw new NotFoundException('Imóvel não encontrado.');
    return imovel;
  }

  private validar_areas(util: string, total: string) {
    if (Number(util) <= 0 || Number(total) < Number(util)) throw new BadRequestException('Área útil deve ser positiva e não pode superar a área total.');
  }

  private async validar_referencias(gerenciador: EntityManager, dto: AtualizarImovelDto, usuario: UsuarioAutenticado) {
    if (dto.tipo_id && !await gerenciador.getRepository(TipoImovel).findOne({ where: { id: dto.tipo_id, ativo: true }, lock: { mode: 'pessimistic_read' } })) throw new BadRequestException('Tipo de imóvel ativo não encontrado.');
    if (dto.finalidade_id && !await gerenciador.getRepository(FinalidadeImovel).findOne({ where: { id: dto.finalidade_id, ativo: true }, lock: { mode: 'pessimistic_read' } })) throw new BadRequestException('Finalidade ativa não encontrada.');
    if (dto.corretor_id && usuario.cargo !== 'ADMIN' && dto.corretor_id !== usuario.id) throw new ForbiddenException('Somente ADMIN pode atribuir imóvel a outro corretor.');
    const corretor_id = dto.corretor_id ?? usuario.id;
    if (!await gerenciador.getRepository(Corretor).findOne({ where: { id: corretor_id, ativo: true }, lock: { mode: 'pessimistic_read' } })) throw new BadRequestException('Corretor ativo não encontrado.');
  }

  private async salvar_caracteristicas(gerenciador: EntityManager, id: string, dados: CaracteristicaImovelDto[], usuario: UsuarioAutenticado) {
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
