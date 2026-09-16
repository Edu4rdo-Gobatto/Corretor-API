import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AlterarContratoDto, ConsultaContratosDto, CriarContratoDto } from './locacoes.dto';

describe('validação de contratos', () => {
  const base = { numero_contrato: 'LOC-2026-001', imovel_id: 1, locador_id: 2, locatario_id: 3, corretor_id: 1, data_inicio: '2026-01-01', data_fim: '2026-12-31', valor_aluguel: '1000.00', dia_vencimento: 5, taxa_administracao: '10.00', garantia_locaticia: 'Caução', indice_reajuste: 'IPCA', cobranca_iptu_condominio: 'Pagamento direto' };
  it('aceita ids inteiros e recusa ids textuais ou fracionários', () => {
    expect(validateSync(plainToInstance(CriarContratoDto, base))).toHaveLength(0);
    const erros = validateSync(plainToInstance(CriarContratoDto, { ...base, imovel_id: 'abc', locador_id: 1.5, locatario_id: 0 }));
    expect(erros.map(erro => erro.property).sort()).toEqual(['imovel_id', 'locador_id', 'locatario_id']);
  });
  it('recusa valores negativos, vencimento fora do mês e campos de integração enviados pelo cliente', () => {
    const erros = validateSync(plainToInstance(CriarContratoDto, { valor_aluguel: '-1.00', dia_vencimento: 32, url_pasta_drive: 'https://example.com' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(erros.map(erro => erro.property)).toEqual(expect.arrayContaining(['valor_aluguel', 'dia_vencimento', 'url_pasta_drive']));
  });
  it('PATCH recusa nulos em campos obrigatórios e a consulta converte ids da query', () => {
    expect(validateSync(plainToInstance(AlterarContratoDto, { numero_contrato: null })).length).toBeGreaterThan(0);
    const consulta = plainToInstance(ConsultaContratosDto, { imovel_id: '4', pessoa_id: '9', ativo: 'false' });
    expect(validateSync(consulta)).toHaveLength(0);
    expect(consulta).toMatchObject({ imovel_id: 4, pessoa_id: 9, ativo: false });
  });
});
