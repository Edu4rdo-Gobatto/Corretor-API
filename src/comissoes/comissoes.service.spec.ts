import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ComissoesService } from './comissoes.service';
import { Comissao } from './comissao.entity';
import { ParcelaComissao } from './parcela-comissao.entity';
import { Pessoa } from '../pessoas/pessoa.entity';
import { Imovel } from '../imoveis/imovel.entity';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('receita e baixa de comissões', () => {
  const usuario: UsuarioAutenticado = { id: 1, nome: 'Corretor', email: 'corretor@example.test', cargo: 'CORRETOR' };
  const dto = { tipo_operacao: 'VENDA' as const, imovel_id: 1, pessoa_id: 2, valor_total: '100.00', quantidade_parcelas: 3, primeiro_vencimento: '2028-01-31' };
  function ambiente() {
    const pessoa = { id: 2, corretor_id: usuario.id, imovel_id: 1, ativo: true };
    const imovel = { id: 1, corretor_id: usuario.id, ativo: true };
    const comissao = Object.assign(new Comissao(), { id: 1, imovel_id: 1, pessoa_id: 2, ativo: true });
    const parcela = Object.assign(new ParcelaComissao(), { id: 1, comissao_id: 1, status: 'ATRASADO', ativo: true, pago_em: null });
    const salvos: (Comissao | ParcelaComissao)[] = [];
    const gerenciador = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn((entidade: unknown) => Promise.resolve(entidade === Imovel ? imovel : entidade === Pessoa ? pessoa : entidade === Comissao ? comissao : parcela)),
      create: jest.fn((entidade: unknown, valor: object) => Object.assign(entidade === Comissao ? new Comissao() : new ParcelaComissao(), valor)),
      save: jest.fn((registro: Comissao | ParcelaComissao | ParcelaComissao[]) => {
        if (Array.isArray(registro)) { salvos.push(...registro); return Promise.resolve(registro); }
        registro.id ||= 1; salvos.push(registro); return Promise.resolve(registro);
      }),
    };
    const banco = { transaction: (operacao: (m: EntityManager) => Promise<unknown>) => operacao(gerenciador as unknown as EntityManager) };
    return { pessoa, imovel, comissao, parcela, salvos, gerenciador, servico: new ComissoesService(banco as unknown as DataSource) };
  }
  it('gera parcelas mensais conservando o total exato', async () => {
    const { servico, salvos } = ambiente(); await servico.criar(dto, usuario);
    const parcelas = salvos.filter(p => p instanceof ParcelaComissao);
    expect(parcelas.map(p => p.valor)).toEqual(['33.34', '33.33', '33.33']);
    expect(parcelas.map(p => p.data_vencimento)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
  });
  it('não revela pessoas de outro corretor e recusa pessoa de outro imóvel', async () => {
    const { servico, pessoa } = ambiente(); pessoa.corretor_id = 9;
    await expect(servico.criar(dto, usuario)).rejects.toBeInstanceOf(NotFoundException);
    pessoa.corretor_id = usuario.id; pessoa.imovel_id = 9;
    await expect(servico.criar(dto, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('exige contrato na locação e impede contrato na venda', async () => {
    await expect(ambiente().servico.criar({ ...dto, tipo_operacao: 'LOCACAO' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ambiente().servico.criar({ ...dto, contrato_id: 3 }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('exige confirmação e comprovante, e baixa uma parcela somente uma vez', async () => {
    const { servico, parcela } = ambiente();
    await expect(servico.pagarParcela(1, { confirmar_pagamento: true, observacao_pagamento: ' ' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
    await servico.pagarParcela(1, { confirmar_pagamento: true, observacao_pagamento: 'PIX comprovante 123' }, usuario);
    expect(parcela.status).toBe('PAGO'); expect(parcela.pago_em).toBeInstanceOf(Date);
    const instante = parcela.pago_em;
    await servico.pagarParcela(1, { confirmar_pagamento: true, observacao_pagamento: 'PIX comprovante 123' }, usuario);
    expect(parcela.pago_em).toBe(instante);
  });
});
