import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Pessoa, StatusContato } from './pessoa.entity';
import { PessoasService } from './pessoas.service';
import { ConsultaPessoasDto } from './pessoas.dto';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('cadastro único de pessoas', () => {
  const usuario: UsuarioAutenticado = { id: 1, nome: 'Ana', email: 'ana@example.test', cargo: 'CORRETOR' };
  const admin: UsuarioAutenticado = { ...usuario, id: 2, cargo: 'ADMIN' };
  const criar = () => {
    const consulta = { andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]), getOne: jest.fn().mockResolvedValue(null) };
    const salvar = jest.fn((valor: object) => Promise.resolve(Object.assign(new Pessoa(), valor, { id: 10 })));
    const existente = Object.assign(new Pessoa(), { id: 5, corretor_id: usuario.id, ativo: true, nome: 'Pessoa', tipo_pessoa: null, cpf_cnpj: null, data_nascimento: null });
    const repositorio = { createQueryBuilder: () => consulta, findOne: jest.fn().mockResolvedValue(existente), save: salvar, create: (valor: object) => Object.assign(new Pessoa(), valor) } as unknown as Repository<Pessoa>;
    const imoveis = { findOne: jest.fn().mockResolvedValue({ id: 1, corretor_id: usuario.id }) };
    const corretores = { findOne: jest.fn().mockResolvedValue({ id: usuario.id, ativo: true }) };
    const contratos = jest.fn().mockResolvedValue(0);
    const gerenciador = { getRepository: (tipo: { name: string }) => tipo.name === 'Pessoa' ? repositorio : tipo.name === 'Imovel' ? imoveis : corretores, count: contratos };
    const banco = { transaction: async (acao: (valor: typeof gerenciador) => Promise<unknown>) => acao(gerenciador) } as unknown as DataSource;
    return { servico: new PessoasService(repositorio, banco), consulta, salvar, imoveis, existente, contratos };
  };
  it('corretor vê as suas pessoas e as vinculadas a contratos seus; ADMIN vê todas', async () => {
    const { servico, consulta } = criar();
    await servico.listar(Object.assign(new ConsultaPessoasDto(), { busca: 'Ana (66) 9', status_contato: 'PENDENTE' }), usuario);
    expect(consulta.andWhere).toHaveBeenCalledWith(expect.stringContaining('pessoa.corretor_id = :usuario OR EXISTS'), { usuario: usuario.id });
    expect(consulta.andWhere).toHaveBeenCalledWith(expect.stringContaining('pessoa.telefone LIKE :digitos'), { termo: '%Ana (66) 9%', digitos: '%669%' });
    expect(consulta.andWhere).toHaveBeenCalledWith('pessoa.status_contato = :status', { status: 'PENDENTE' });
    consulta.andWhere.mockClear();
    await servico.listar(new ConsultaPessoasDto(), admin);
    expect(consulta.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('pessoa.corretor_id = :usuario'), expect.anything());
  });
  it('recusa período invertido e acesso a pessoa invisível', async () => {
    const { servico } = criar();
    await expect(servico.listar(Object.assign(new ConsultaPessoasDto(), { criado_desde: '2026-09-03T00:00:00Z', criado_ate: '2026-09-01T00:00:00Z' }), usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.obter(99, usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('não permite corretor comum atribuir cadastro a outra pessoa', async () => {
    const { servico, salvar } = criar();
    await expect(servico.criarManual({ nome: 'Pessoa', telefone: '66999999999', corretor_id: 9 }, usuario)).rejects.toBeInstanceOf(ForbiddenException);
    expect(salvar).not.toHaveBeenCalled();
  });
  it('grava cadastro manual auditado, respondido por padrão, sem inventar consentimento e deduzindo o tipo pelo documento', async () => {
    const { servico, salvar } = criar();
    const resposta = await servico.criarManual({ nome: 'Empresa', telefone: '66999999999', cpf_cnpj: '11222333000181' }, usuario);
    expect(salvar.mock.calls[0][0]).toMatchObject({ origem: 'MANUAL', status_contato: 'RESPONDIDO', consentimento: false, consentimento_ip: null, imovel_id: null, tipo_pessoa: 'PJ', criado_por: usuario.id, alterado_por: usuario.id });
    expect(resposta).not.toHaveProperty('consentimento_ip');
    await expect(servico.criarManual({ nome: 'Pessoa', telefone: '66999999999', tipo_pessoa: 'PF', cpf_cnpj: '11222333000181' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('recusa consentimento falso e imóvel indisponível no contato do site', async () => {
    const { servico, imoveis, salvar } = criar();
    await expect(servico.criarPublico({ nome: 'Pessoa', telefone: '66999999999', imovel_id: 1, consentimento: false as true }, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    imoveis.findOne.mockResolvedValue(null);
    await expect(servico.criarPublico({ nome: 'Pessoa', telefone: '66999999999', imovel_id: 1, consentimento: true }, '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException);
    expect(salvar).not.toHaveBeenCalled();
  });
  it('contato do site entra pendente com IP e responde só o id', async () => {
    const { servico, salvar } = criar();
    const resposta = await servico.criarPublico({ nome: 'Pessoa', telefone: '66999999999', imovel_id: 1, consentimento: true }, '127.0.0.1');
    expect(resposta).toEqual({ id: 10 });
    expect(salvar.mock.calls[0][0]).toMatchObject({ consentimento: true, consentimento_ip: '127.0.0.1', corretor_id: usuario.id, origem: 'SITE', status_contato: 'PENDENTE' });
  });
  it('desativação é bloqueada com contrato ativo e a situação do contato pode avançar', async () => {
    const { servico, contratos, existente } = criar();
    contratos.mockResolvedValue(1);
    await expect(servico.atualizar(5, { ativo: false }, usuario)).rejects.toBeInstanceOf(ConflictException);
    contratos.mockResolvedValue(0);
    await expect(servico.atualizar(5, { status_contato: StatusContato.FINALIZADO }, usuario)).resolves.toMatchObject({ status_contato: 'FINALIZADO' });
    existente.corretor_id = 9;
    await expect(servico.atualizar(5, { nome: 'Outra' }, usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});
