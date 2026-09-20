import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ImovelCaracteristica } from '../cadastros/cadastros.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Corretor } from '../corretores/corretor.entity';
import { ImovelMidia, TipoMidia } from '../midias/imovel-midia.entity';
import { ConsultaImoveisDto, ConsultaInternaImoveisDto, CriarImovelDto } from './imoveis.dto';
import { Imovel, StatusImovel } from './imovel.entity';
import { resposta_imovel, resposta_imovel_publico } from './imoveis.resposta';
import { ImoveisService } from './imoveis.service';

describe('Catálogo e gestão de imóveis', () => {
  const usuario: UsuarioAutenticado = { id: 1, nome: 'Responsável', email: 'privado@example.test', cargo: 'CORRETOR' };
  const imovel = Object.assign(new Imovel(), { id: 42, corretor_id: usuario.id, status: StatusImovel.DISPONIVEL, ativo: true, slug: 'galpao-centro-42' });
  const consulta = { innerJoin: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), clone: jest.fn().mockReturnThis(), getCount: jest.fn(), select: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(), offset: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), getRawMany: jest.fn() };
  const finalidades = { findOneBy: jest.fn() };
  const repositorio = { createQueryBuilder: jest.fn(() => consulta), find: jest.fn(), findOne: jest.fn(), manager: { getRepository: () => finalidades, transaction: jest.fn() } };
  const midias = { find: jest.fn() };
  const caracteristicas = { find: jest.fn() };
  const servico = new ImoveisService(repositorio as unknown as Repository<Imovel>, midias as unknown as Repository<ImovelMidia>, caracteristicas as unknown as Repository<ImovelCaracteristica>);

  beforeEach(() => { consulta.getCount.mockResolvedValue(0); consulta.getRawMany.mockResolvedValue([]); repositorio.find.mockResolvedValue([]); midias.find.mockResolvedValue([]); caracteristicas.find.mockResolvedValue([]); });

  it('catálogo público exige imóvel ativo/disponível e corretor ativo; o interno não restringe', async () => {
    await servico.listar_publicos(new ConsultaImoveisDto());
    expect(consulta.andWhere).toHaveBeenCalledWith(expect.stringContaining('imovel.status = :disponivel'), { disponivel: 'DISPONIVEL' });
    consulta.andWhere.mockClear();
    await servico.listar_internos(new ConsultaInternaImoveisDto());
    expect(consulta.andWhere).not.toHaveBeenCalled();
  });

  it('ordena pelo preço da finalidade, filtra por bairro/área e busca por id com #', async () => {
    finalidades.findOneBy.mockResolvedValue({ id: 2, slug: 'locacao' });
    await servico.listar_publicos(Object.assign(new ConsultaImoveisDto(), { finalidade_id: 2, ordenar: 'valor_asc', bairro: 'Centro', area_min: '50', busca: '#42' }));
    expect(consulta.orderBy).toHaveBeenCalledWith('imovel.valor_locacao', 'ASC', 'NULLS LAST');
    expect(consulta.andWhere).toHaveBeenCalledWith('imovel.bairro ILIKE :bairro', { bairro: '%Centro%' });
    expect(consulta.andWhere).toHaveBeenCalledWith('imovel.area_util >= :area_min', { area_min: '50' });
    expect(consulta.andWhere).toHaveBeenCalledWith('imovel.id = :busca_id', { busca_id: 42 });
    finalidades.findOneBy.mockResolvedValue(null);
    await servico.listar_publicos(Object.assign(new ConsultaImoveisDto(), { ordenar: 'valor_desc', busca: 'galpão' }));
    expect(consulta.orderBy).toHaveBeenCalledWith('COALESCE(imovel.valor_venda, imovel.valor_locacao)', 'DESC', 'NULLS LAST');
    expect(consulta.andWhere).toHaveBeenCalledWith(expect.stringContaining('imovel.descricao ILIKE :termo'), { termo: '%galpão%' });
  });

  it('carrega mídias separadamente, preserva a ordem da consulta e remove dados privados', async () => {
    const outro = Object.assign(new Imovel(), imovel, { id: 7 });
    consulta.getCount.mockResolvedValue(2); consulta.getRawMany.mockResolvedValue([{ id: '42' }, { id: 7 }]);
    repositorio.find.mockResolvedValue([outro, imovel]);
    midias.find.mockResolvedValue([Object.assign(new ImovelMidia(), { id: 1, imovel_id: imovel.id, chave_armazenamento: 'segredo', tipo: TipoMidia.IMAGEM })]);
    const resultado = await servico.listar_publicos(new ConsultaImoveisDto());
    expect(resultado).toMatchObject({ total: 2, total_paginas: 1 });
    expect(resultado.itens.map((item) => item.id)).toEqual([42, 7]);
    expect(resultado.itens[0].midias).toHaveLength(1);
    expect(JSON.stringify(resultado)).not.toMatch(/chave_armazenamento|proprietario|matricula|observacoes_internas/);
    expect(repositorio.find).toHaveBeenCalledWith(expect.objectContaining({ relations: { corretor: true, tipo: true, finalidade: true, proprietario: false } }));
  });

  it('detalhe público localiza pelo id no fim do slug e recusa slug sem id', async () => {
    repositorio.findOne.mockResolvedValue(imovel);
    await expect(servico.encontrar_publico('galpao-renomeado-42')).resolves.toMatchObject({ id: 42, slug: 'galpao-centro-42' });
    expect(repositorio.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42, ativo: true, status: 'DISPONIVEL', corretor: { ativo: true } } }));
    await expect(servico.encontrar_publico('galpao-sem-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deixa o banco gerar o id e grava o slug com o id real, sem reservar nextval', async () => {
    const ids_enviados: Array<number | undefined> = [];
    const slugs_enviados: string[] = [];
    const imoveis = {
      create: (dados: Partial<Imovel>) => Object.assign(new Imovel(), dados),
      // Reproduz o identity do PostgreSQL: o id enviado no INSERT é descartado e o banco atribui o próximo.
      save: jest.fn((entidade: Imovel) => { ids_enviados.push(entidade.id); slugs_enviados.push(entidade.slug); entidade.id = 7; return Promise.resolve(entidade); }),
      update: jest.fn(),
    };
    const referencias = { findOne: jest.fn().mockResolvedValue({ id: usuario.id, ativo: true }) };
    const gerenciador = { getRepository: (alvo: unknown) => (alvo === Imovel ? imoveis : referencias), query: jest.fn() };
    repositorio.manager.transaction.mockImplementation((executar: (contexto: unknown) => Promise<void>) => executar(gerenciador));
    repositorio.findOne.mockResolvedValue(Object.assign(new Imovel(), imovel, { id: 7, slug: 'galpao-centro-7' }));
    const dto = Object.assign(new CriarImovelDto(), { titulo: 'Galpão Centro', tipo_id: 1, finalidade_id: 2, area_util: '100.00', area_total: '120.00' });

    const criado = await servico.criar(dto, usuario);

    expect(ids_enviados).toEqual([undefined]);
    expect(slugs_enviados[0]).toMatch(/^rascunho-/);
    expect(gerenciador.query).not.toHaveBeenCalled();
    expect(imoveis.update).toHaveBeenCalledWith(7, { slug: 'galpao-centro-7' });
    expect(criado).toMatchObject({ id: 7, slug: 'galpao-centro-7' });
  });

  it('impede edição por outro corretor e permite responsável ou ADMIN', () => {
    expect(() => servico.verificar_edicao(imovel, { ...usuario, id: 2 })).toThrow(ForbiddenException);
    expect(() => servico.verificar_edicao(imovel, usuario)).not.toThrow();
    expect(() => servico.verificar_edicao(imovel, { ...usuario, id: 3, cargo: 'ADMIN' })).not.toThrow();
  });

  it('não expõe email, CPF, cargo ou senha do corretor; ficha interna traz proprietário e anotações', () => {
    const objeto = Object.assign(new Imovel(), imovel, { corretor: Object.assign(new Corretor(), { nome: 'Responsável', cpf: 'privado', email: 'privado', cargo: 'ADMIN', senha_hash: 'privado' }), chaves: 'Com o zelador', proprietario_id: 3 });
    expect(JSON.stringify(resposta_imovel_publico(objeto))).not.toMatch(/privado|senha_hash|"cargo"|"cpf"|"email"|chaves|proprietario/);
    expect(resposta_imovel(objeto)).toMatchObject({ chaves: 'Com o zelador', proprietario_id: 3, proprietario: null });
  });

  it('rejeita intervalos invertidos de preço e área antes da consulta', async () => {
    await expect(servico.listar_publicos(Object.assign(new ConsultaImoveisDto(), { valor_min: '200', valor_max: '100' }))).rejects.toThrow('valor_min');
    await expect(servico.listar_publicos(Object.assign(new ConsultaImoveisDto(), { area_min: '90', area_max: '10' }))).rejects.toThrow('area_min');
    expect(repositorio.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('DELETE desativa e preserva o imóvel', async () => {
    const atualizar = jest.spyOn(servico, 'atualizar').mockResolvedValue(resposta_imovel(imovel));
    await servico.desativar(imovel.id, usuario);
    expect(atualizar).toHaveBeenCalledWith(imovel.id, { ativo: false }, usuario);
    atualizar.mockRestore();
  });
});
