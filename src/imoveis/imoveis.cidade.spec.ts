import { BadRequestException } from '@nestjs/common';
import { Cidade, FinalidadeImovel, TipoImovel } from '../cadastros/cadastros.entity';
import { Corretor } from '../corretores/corretor.entity';
import { ImoveisService } from './imoveis.service';
import { Imovel, StatusImovel } from './imovel.entity';

/** Cadastro simulado: só "Juara/MT" existe e está ativa. */
const cidadeCadastrada = (where: { nome_normalizado: string; estado: string; ativo: boolean }) =>
  where.nome_normalizado === 'juara' && where.estado === 'MT' && where.ativo ? { id: 1 } : null;

function montar(existente?: Partial<Imovel>) {
  const salvos: Partial<Imovel>[] = [];
  const repositorioImovel = {
    findOne: jest.fn(() => Promise.resolve(existente ? { ...existente } : null)),
    create: jest.fn((dados: Partial<Imovel>) => ({ ...dados })),
    save: jest.fn((imovel: Partial<Imovel>) => { salvos.push(imovel); return Promise.resolve(Object.assign(imovel, { id: imovel.id ?? 9 })); }),
    update: jest.fn(() => Promise.resolve()),
  };
  const gerenciador = {
    getRepository: (entidade: unknown) => {
      if (entidade === Imovel) return repositorioImovel;
      if (entidade === Cidade) return { findOne: jest.fn(({ where }: { where: never }) => Promise.resolve(cidadeCadastrada(where))) };
      if (entidade === TipoImovel || entidade === FinalidadeImovel || entidade === Corretor) return { findOne: jest.fn(() => Promise.resolve({ id: 1 })) };
      return { findOne: jest.fn(() => Promise.resolve(null)) };
    },
  };
  const imoveis = { manager: { transaction: (trabalho: (g: typeof gerenciador) => Promise<unknown>) => trabalho(gerenciador) } };
  const servicoImoveis = new ImoveisService(imoveis as never, {} as never, {} as never);
  // O retorno (`encontrar_interno`) não é o alvo destes testes.
  jest.spyOn(servicoImoveis, 'encontrar_interno').mockResolvedValue({} as never);
  return { servico: servicoImoveis, salvos };
}

const usuario = { id: 1, cargo: 'ADMIN' } as never;
const dados = { titulo: 'Sala', tipo_id: 1, finalidade_id: 1, area_util: '10.00', area_total: '10.00', logradouro: 'Rua A', numero: '1', bairro: 'Centro', descricao: 'Sala comercial' };

describe('ImoveisService: cidade do cadastro', () => {
  it('cria imóvel com cidade cadastrada, ignorando acento e caixa', async () => {
    const { servico, salvos } = montar();
    await servico.criar({ ...dados, cidade: 'JUARA', estado: 'MT' }, usuario);
    expect(salvos).toHaveLength(1);
  });

  it('recusa cidade fora do cadastro ao criar', async () => {
    const { servico } = montar();
    await expect(servico.criar({ ...dados, cidade: 'Sinop', estado: 'MT' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('imóvel antigo com cidade fora do cadastro salva se a cidade não mudar', async () => {
    const antigo = { id: 3, titulo: 'Sala', cidade: 'Sinop', estado: 'MT', corretor_id: 1, area_util: '10.00', area_total: '10.00', status: StatusImovel.DISPONIVEL };
    const { servico, salvos } = montar(antigo);
    await servico.atualizar(3, { titulo: 'Sala nova', cidade: 'Sinop', estado: 'MT' }, usuario);
    expect(salvos[0]).toMatchObject({ titulo: 'Sala nova', cidade: 'Sinop' });
  });

  it('trocar para cidade fora do cadastro é recusado', async () => {
    const antigo = { id: 3, titulo: 'Sala', cidade: 'Juara', estado: 'MT', corretor_id: 1, area_util: '10.00', area_total: '10.00' };
    const { servico } = montar(antigo);
    await expect(servico.atualizar(3, { cidade: 'Sinop' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
});
