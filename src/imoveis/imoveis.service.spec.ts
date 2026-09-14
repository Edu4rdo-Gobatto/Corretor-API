import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ImovelCaracteristica } from '../cadastros/cadastros.entity';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Corretor } from '../corretores/corretor.entity';
import { ImovelMidia, TipoMidia } from '../midias/imovel-midia.entity';
import { ConsultaImoveisDto, ConsultaInternaImoveisDto } from './imoveis.dto';
import { Imovel, StatusImovel } from './imovel.entity';
import { resposta_imovel } from './imoveis.resposta';
import { ImoveisService } from './imoveis.service';

describe('Catálogo e gestão de imóveis', () => {
  const usuario: UsuarioAutenticado = { id: 'corretor-1', nome: 'Responsável', email: 'privado@example.test', cargo: 'CORRETOR' };
  const imovel = Object.assign(new Imovel(), { id: 'imovel-1', corretor_id: usuario.id, status: StatusImovel.DISPONIVEL, ativo: true });
  const repositorio = { findAndCount: jest.fn(), findOne: jest.fn() };
  const midias = { find: jest.fn() };
  const caracteristicas = { find: jest.fn() };
  const servico = new ImoveisService(repositorio as unknown as Repository<Imovel>, midias as unknown as Repository<ImovelMidia>, caracteristicas as unknown as Repository<ImovelCaracteristica>);

  beforeEach(() => { repositorio.findAndCount.mockResolvedValue([[], 0]); midias.find.mockResolvedValue([]); caracteristicas.find.mockResolvedValue([]); });

  it('catálogo público exige imóvel ativo/disponível e corretor ativo', async () => {
    await servico.listar_publicos(new ConsultaImoveisDto());
    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true, status: 'DISPONIVEL', corretor: { ativo: true } } }));
  });

  it('leitura interna inclui imóveis de toda a imobiliária sem restringir ao responsável', async () => {
    await servico.listar_internos(new ConsultaInternaImoveisDto());
    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    repositorio.findOne.mockResolvedValue(imovel);
    await expect(servico.encontrar_interno(imovel.id)).resolves.toMatchObject({ id: imovel.id });
  });

  it('carrega mídias separadamente para manter paginação de imóveis e remove dados privados', async () => {
    repositorio.findAndCount.mockResolvedValue([[imovel], 1]);
    midias.find.mockResolvedValue([Object.assign(new ImovelMidia(), { id: 'foto-1', imovel_id: imovel.id, chave_armazenamento: 'segredo', tipo: TipoMidia.IMAGEM })]);
    const resultado = await servico.listar_publicos(new ConsultaImoveisDto());
    expect(resultado.itens[0].midias).toHaveLength(1);
    expect(JSON.stringify(resultado)).not.toContain('chave_armazenamento');
    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ relations: { corretor: true, tipo: true, finalidade: true } }));
  });

  it('impede edição por outro corretor e permite responsável ou ADMIN', () => {
    expect(() => servico.verificar_edicao(imovel, { ...usuario, id: 'outro' })).toThrow(ForbiddenException);
    expect(() => servico.verificar_edicao(imovel, usuario)).not.toThrow();
    expect(() => servico.verificar_edicao(imovel, { ...usuario, id: 'admin', cargo: 'ADMIN' })).not.toThrow();
  });

  it('não expõe email, CPF, cargo ou senha do corretor no imóvel', () => {
    const objeto = Object.assign(new Imovel(), imovel, { corretor: Object.assign(new Corretor(), { nome: 'Responsável', cpf: 'privado', email: 'privado', cargo: 'ADMIN', senha_hash: 'privado' }) });
    expect(JSON.stringify(resposta_imovel(objeto))).not.toMatch(/privado|senha_hash|"cargo"|"cpf"|"email"/);
  });

  it('rejeita intervalo de preço invertido antes da consulta', async () => {
    const consulta = Object.assign(new ConsultaImoveisDto(), { valor_min: '200', valor_max: '100' });
    await expect(servico.listar_publicos(consulta)).rejects.toThrow('valor_min');
    expect(repositorio.findAndCount).not.toHaveBeenCalled();
  });

  it('DELETE desativa e preserva o imóvel', async () => {
    const atualizar = jest.spyOn(servico, 'atualizar').mockResolvedValue(resposta_imovel(imovel));
    await servico.desativar(imovel.id, usuario);
    expect(atualizar).toHaveBeenCalledWith(imovel.id, { ativo: false }, usuario);
    atualizar.mockRestore();
  });
});
