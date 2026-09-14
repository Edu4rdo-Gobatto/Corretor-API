import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DriveService } from '../drive/drive.service';
import { ParteLocacao } from './parte-locacao.entity';
import { LocacoesService } from './locacoes.service';
import { Contrato } from './contrato.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Corretor } from '../corretores/corretor.entity';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('segurança e integridade das locações', () => {
  const admin: UsuarioAutenticado = { id: 'admin', nome: 'Admin', email: 'admin@example.test', cargo: 'ADMIN' };
  const corretor: UsuarioAutenticado = { ...admin, id: 'intermediador', cargo: 'CORRETOR' };
  const dto = { numero_contrato: 'LOC-2026-001', imovel_id: 'imovel', locador_id: 'locador', locatario_id: 'locatario', corretor_id: corretor.id, data_inicio: '2026-01-01', data_fim: '2099-12-31', valor_aluguel: '1000.00', dia_vencimento: 31, taxa_administracao: '10.00', garantia_locaticia: 'Caução', indice_reajuste: 'IPCA', cobranca_iptu_condominio: 'Pagamento direto' };
  function ambiente() {
    const partes = [Object.assign(new ParteLocacao(), { id: 'locador', ativo: true, papel: 'LOCADOR', tipo_pessoa: 'PF', cpf_cnpj: '52998224725', nome: 'Locador' }), Object.assign(new ParteLocacao(), { id: 'locatario', ativo: true, papel: 'LOCATARIO', nome: 'Locatário' })];
    const contratos: Contrato[] = [];
    const gerenciador = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn((entidade: unknown, opcoes: { where: { id: string } }) => {
        if (entidade === ParteLocacao) return Promise.resolve(partes.find(p => p.id === opcoes.where.id) ?? null);
        if (entidade === Imovel) return Promise.resolve({ id: 'imovel', ativo: true });
        if (entidade === Corretor) return Promise.resolve({ id: corretor.id, ativo: true });
        return Promise.resolve(contratos.find(c => c.id === opcoes.where.id) ?? null);
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_entidade: unknown, valor: object) => Object.assign(new Contrato(), valor)),
      save: jest.fn((registro: Contrato | ParteLocacao) => { if (registro instanceof Contrato) { registro.id ||= 'contrato'; contratos.push(registro); } return Promise.resolve(registro); }),
    };
    const banco = { transaction: (operacao: (m: EntityManager) => Promise<unknown>) => operacao(gerenciador as unknown as EntityManager), query: gerenciador.query, getRepository: jest.fn().mockReturnValue({ update: jest.fn().mockResolvedValue({ affected: 1 }), findOneBy: jest.fn(() => Promise.resolve(contratos[0])) }) };
    const drive = { criarPastaContrato: jest.fn().mockRejectedValue(new Error('indisponível')) };
    return { partes, contratos, gerenciador, drive, servico: new LocacoesService(banco as unknown as DataSource, drive as unknown as DriveService) };
  }
  it('bloqueia alteração de partes por corretor e CPF incompatível com PJ', async () => {
    const { servico } = ambiente();
    await expect(servico.alterarParte('locador', { nome: 'Novo' }, corretor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servico.alterarParte('locador', { tipo_pessoa: 'PJ' }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('bloqueia arquivamento de parte vinculada a contrato ativo sob lock', async () => {
    const { servico, gerenciador } = ambiente(); gerenciador.count.mockResolvedValue(1);
    await expect(servico.alterarParte('locador', { ativo: false }, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), expect.any(Array));
  });
  it('não permite corretor atribuir contrato a outro intermediador', async () => {
    await expect(ambiente().servico.criarContrato({ ...dto, corretor_id: 'outro' }, corretor)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('recusa partes inativas, papel incorreto e intervalo de datas invertido', async () => {
    const { servico, partes } = ambiente(); partes[1].ativo = false;
    await expect(servico.criarContrato(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
    partes[1].ativo = true; partes[1].papel = 'LOCADOR';
    await expect(servico.criarContrato(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.criarContrato({ ...dto, data_fim: '2025-01-01' }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('preserva o contrato salvo quando o Drive falha e permite retry sem criar outro contrato', async () => {
    const { servico, contratos, drive } = ambiente();
    const salvo = await servico.criarContrato(dto, admin);
    expect(salvo.id).toBe('contrato');
    expect(salvo.status_pasta_drive).toBe('FALHOU');
    expect(contratos).toHaveLength(1);
    expect(drive.criarPastaContrato).toHaveBeenCalledTimes(1);
  });
});
