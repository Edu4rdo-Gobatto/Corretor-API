import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, ILike, MoreThanOrEqual, Repository } from 'typeorm';
import { Cliente } from './cliente.entity';
import { ClientesService } from './clientes.service';
import { ConsultaClientesDto } from './clientes.dto';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('privacidade e cadastro de clientes', () => {
  const usuario: UsuarioAutenticado = { id: 'corretor-1', nome: 'Ana', email: 'ana@example.test', cargo: 'CORRETOR' };
  const criar = () => {
    const buscar = jest.fn().mockResolvedValue(null);
    const listar = jest.fn<Promise<[Cliente[], number]>, [Parameters<Repository<Cliente>['findAndCount']>[0]]>().mockResolvedValue([[], 0]);
    const salvar = jest.fn((valor: object) => Promise.resolve({ id: 'cliente-1', ...valor }));
    const repositorio = { findOne: buscar, findAndCount: listar, save: salvar, create: (valor: object) => valor } as unknown as Repository<Cliente>;
    const imoveis = { findOne: jest.fn().mockResolvedValue({ id: 'imovel-1', corretor_id: usuario.id }) };
    const corretores = { findOne: jest.fn().mockResolvedValue({ id: usuario.id, ativo: true }) };
    const gerenciador = { getRepository: (tipo: { name: string }) => tipo.name === 'Cliente' ? repositorio : tipo.name === 'Imovel' ? imoveis : corretores };
    const banco = { transaction: async (acao: (valor: typeof gerenciador) => Promise<unknown>) => acao(gerenciador) } as unknown as DataSource;
    return { servico: new ClientesService(repositorio, banco), buscar, listar, salvar, imoveis };
  };
  it('filtra clientes pelo atendente e não pelo responsável do imóvel', async () => {
    const { servico, listar } = criar();
    await servico.listar(Object.assign(new ConsultaClientesDto(), { busca: 'Ana%' }), usuario);
    expect(listar.mock.calls[0][0]?.where).toEqual({ corretor_id: usuario.id, nome: ILike('%Ana\\%%') });
  });
  it('aplica intervalo de criação sem remover o escopo do corretor', async () => {
    const { servico, listar } = criar();
    await servico.listar(Object.assign(new ConsultaClientesDto(), { criado_desde:'2026-09-01T00:00:00Z' }), usuario);
    expect(listar.mock.calls[0][0]?.where).toEqual({corretor_id:usuario.id,criado_em:MoreThanOrEqual(new Date('2026-09-01T00:00:00Z'))});
    await expect(servico.listar(Object.assign(new ConsultaClientesDto(), {criado_desde:'2026-09-03T00:00:00Z',criado_ate:'2026-09-01T00:00:00Z'}),usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('recusa acesso direto a cliente de outro atendente', async () => {
    const { servico, buscar } = criar();
    await expect(servico.obter('cliente-outro', usuario)).rejects.toBeInstanceOf(NotFoundException);
    expect(buscar).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cliente-outro', corretor_id: usuario.id } }));
  });
  it('não permite corretor comum atribuir cadastro a outra pessoa', async () => {
    const { servico, salvar } = criar();
    await expect(servico.criarManual({ nome: 'Cliente', telefone: '66999999999', corretor_id: 'outro' }, usuario)).rejects.toBeInstanceOf(ForbiddenException);
    expect(salvar).not.toHaveBeenCalled();
  });
  it('grava cadastro manual com auditoria e sem inventar consentimento', async () => {
    const { servico, salvar } = criar();
    await servico.criarManual({ nome: 'Cliente', telefone: '66999999999' }, usuario);
    expect(salvar.mock.calls[0][0]).toMatchObject({ origem: 'MANUAL', consentimento: false, consentimento_ip: null, consentimento_em: null, imovel_id: null, criado_por: usuario.id, alterado_por: usuario.id });
  });
  it('recusa consentimento falso e imóvel indisponível mesmo se chamado fora do controller', async () => {
    const { servico, imoveis, salvar } = criar();
    await expect(servico.criarPublico({ nome: 'Cliente', telefone: '66999999999', imovel_id: 'imovel-1', consentimento: false as true }, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    imoveis.findOne.mockResolvedValue(null);
    await expect(servico.criarPublico({ nome: 'Cliente', telefone: '66999999999', imovel_id: 'imovel-1', consentimento: true }, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    expect(salvar).not.toHaveBeenCalled();
  });
  it('resposta pública não devolve dados pessoais ou IP', async () => {
    const { servico, salvar } = criar();
    const resposta = await servico.criarPublico({ nome: 'Cliente', telefone: '66999999999', imovel_id: 'imovel-1', consentimento: true }, '127.0.0.1');
    expect(resposta).toEqual({ id: 'cliente-1' });
    expect(salvar.mock.calls[0][0]).toMatchObject({ consentimento: true, consentimento_ip: '127.0.0.1', corretor_id: usuario.id, origem: 'SITE' });
  });
});
