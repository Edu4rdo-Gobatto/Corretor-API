import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DriveService } from '../drive/drive.service';
import { Pessoa } from '../pessoas/pessoa.entity';
import { LocacoesService } from './locacoes.service';
import { Contrato } from './contrato.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { Corretor } from '../corretores/corretor.entity';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('segurança e integridade das locações', () => {
  const admin: UsuarioAutenticado = { id: 1, nome: 'Admin', email: 'admin@example.test', cargo: 'ADMIN' };
  const corretor: UsuarioAutenticado = { ...admin, id: 2, cargo: 'CORRETOR' };
  const dto = { numero_contrato: 'LOC-2026-001', imovel_id: 1, locador_id: 1, locatario_id: 2, corretor_id: corretor.id, data_inicio: '2026-01-01', data_fim: '2099-12-31', valor_aluguel: '1000.00', dia_vencimento: 31, taxa_administracao: '10.00', garantia_locaticia: 'Caução', indice_reajuste: 'IPCA', cobranca_iptu_condominio: 'Pagamento direto' };
  function ambiente() {
    const pessoas = [Object.assign(new Pessoa(), { id: 1, ativo: true, tipo_pessoa: 'PF', cpf_cnpj: '52998224725', nome: 'Locador' }), Object.assign(new Pessoa(), { id: 2, ativo: true, nome: 'Locatário' })];
    const contratos: Contrato[] = [];
    const gerenciador = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn((entidade: unknown, opcoes: { where: { id: number } }) => {
        if (entidade === Pessoa) return Promise.resolve(pessoas.find(p => p.id === opcoes.where.id) ?? null);
        if (entidade === Imovel) return Promise.resolve({ id: 1, ativo: true, titulo: 'Sala' });
        if (entidade === Corretor) return Promise.resolve({ id: corretor.id, ativo: true });
        return Promise.resolve(contratos.find(c => c.id === opcoes.where.id) ?? null);
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_entidade: unknown, valor: object) => Object.assign(new Contrato(), valor)),
      save: jest.fn((registro: Contrato) => { registro.id ||= 1; contratos.push(registro); return Promise.resolve(registro); }),
    };
    const repositorio = { update: jest.fn().mockResolvedValue({ affected: 1 }), findOneBy: jest.fn(() => Promise.resolve(contratos[0] ?? pessoas[1])), findOne: jest.fn(() => Promise.resolve(contratos[0])) };
    const banco = { transaction: (operacao: (m: EntityManager) => Promise<unknown>) => operacao(gerenciador as unknown as EntityManager), query: gerenciador.query, getRepository: jest.fn().mockReturnValue(repositorio) };
    const drive = { criarPastaContrato: jest.fn().mockRejectedValue(new Error('indisponível')) };
    return { pessoas, contratos, gerenciador, drive, servico: new LocacoesService(banco as unknown as DataSource, drive as unknown as DriveService) };
  }
  it('não permite corretor atribuir contrato a outro intermediador', async () => {
    await expect(ambiente().servico.criarContrato({ ...dto, corretor_id: 9 }, corretor)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('recusa pessoas inativas, pessoa repetida e intervalo de datas invertido', async () => {
    const { servico, pessoas } = ambiente(); pessoas[1].ativo = false;
    await expect(servico.criarContrato(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
    pessoas[1].ativo = true;
    await expect(servico.criarContrato({ ...dto, locatario_id: dto.locador_id }, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.criarContrato({ ...dto, data_fim: '2025-01-01' }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('usa lock de integridade e expira contratos vencidos antes de gravar', async () => {
    const { servico, gerenciador } = ambiente();
    await servico.criarContrato(dto, admin);
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), expect.any(Array));
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining("status = 'INATIVO'"));
  });
  it('preserva o contrato salvo quando o Drive falha e responde com os nomes das partes', async () => {
    const { servico, contratos, drive } = ambiente();
    const salvo = await servico.criarContrato(dto, admin);
    expect(salvo.id).toBe(1);
    expect(salvo.status_pasta_drive).toBe('FALHOU');
    expect(salvo).toMatchObject({ imovel_titulo: null, locador_nome: null, locatario_nome: null });
    expect(contratos).toHaveLength(1);
    expect(drive.criarPastaContrato).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(salvo)).not.toContain('cpf_cnpj');
  });
});
