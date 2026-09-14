import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ComissoesService } from './comissoes.service';
import { Comissao } from './comissao.entity';
import { ParcelaComissao } from './parcela-comissao.entity';
import { Cliente } from '../clientes/cliente.entity';
import { Imovel } from '../imoveis/imovel.entity';
import type { UsuarioAutenticado } from '../comum/usuario-autenticado';

describe('receita e baixa de comissões', () => {
  const usuario: UsuarioAutenticado = { id: 'corretor', nome: 'Corretor', email: 'corretor@example.test', cargo: 'CORRETOR' };
  const dto = { tipo_operacao: 'VENDA' as const, imovel_id: 'imovel', cliente_id: 'cliente', valor_total: '100.00', quantidade_parcelas: 3, primeiro_vencimento: '2028-01-31' };
  function ambiente() {
    const cliente = { id: 'cliente', corretor_id: usuario.id, imovel_id: 'imovel', ativo: true };
    const imovel = { id: 'imovel', corretor_id: usuario.id, ativo: true };
    const comissao = Object.assign(new Comissao(), { id: 'comissao', imovel_id: 'imovel', cliente_id: 'cliente', ativo: true });
    const parcela = Object.assign(new ParcelaComissao(), { id: 'parcela', comissao_id: 'comissao', status: 'ATRASADO', ativo: true, pago_em: null });
    const salvos: (Comissao | ParcelaComissao)[] = [];
    const gerenciador = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn((entidade: unknown) => Promise.resolve(entidade === Imovel ? imovel : entidade === Cliente ? cliente : entidade === Comissao ? comissao : parcela)),
      create: jest.fn((entidade: unknown, valor: object) => Object.assign(entidade === Comissao ? new Comissao() : new ParcelaComissao(), valor)),
      save: jest.fn((registro: Comissao | ParcelaComissao | ParcelaComissao[]) => {
        if (Array.isArray(registro)) { salvos.push(...registro); return Promise.resolve(registro); }
        registro.id ||= 'comissao'; salvos.push(registro); return Promise.resolve(registro);
      }),
    };
    const banco = { transaction: (operacao: (m: EntityManager) => Promise<unknown>) => operacao(gerenciador as unknown as EntityManager) };
    return { cliente, imovel, comissao, parcela, salvos, gerenciador, servico: new ComissoesService(banco as unknown as DataSource) };
  }
  it('gera parcelas mensais conservando o total exato', async () => {
    const { servico, salvos } = ambiente(); await servico.criar(dto, usuario);
    const parcelas = salvos.filter(p => p instanceof ParcelaComissao);
    expect(parcelas.map(p => p.valor)).toEqual(['33.34', '33.33', '33.33']);
    expect(parcelas.map(p => p.data_vencimento)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
  });
  it('não revela clientes de outro corretor e recusa cliente de outro imóvel', async () => {
    const { servico, cliente } = ambiente(); cliente.corretor_id = 'outro';
    await expect(servico.criar(dto, usuario)).rejects.toBeInstanceOf(NotFoundException);
    cliente.corretor_id = usuario.id; cliente.imovel_id = 'outro';
    await expect(servico.criar(dto, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('exige contrato na locação e impede contrato na venda', async () => {
    await expect(ambiente().servico.criar({ ...dto, tipo_operacao: 'LOCACAO' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ambiente().servico.criar({ ...dto, contrato_id: 'contrato' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('exige confirmação e comprovante, e baixa uma parcela somente uma vez', async () => {
    const { servico, parcela } = ambiente();
    await expect(servico.pagarParcela('parcela', { confirmar_pagamento: true, observacao_pagamento: ' ' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
    await servico.pagarParcela('parcela', { confirmar_pagamento: true, observacao_pagamento: 'PIX comprovante 123' }, usuario);
    expect(parcela.status).toBe('PAGO'); expect(parcela.pago_em).toBeInstanceOf(Date);
    const instante = parcela.pago_em;
    await servico.pagarParcela('parcela', { confirmar_pagamento: true, observacao_pagamento: 'PIX comprovante 123' }, usuario);
    expect(parcela.pago_em).toBe(instante);
  });
});
