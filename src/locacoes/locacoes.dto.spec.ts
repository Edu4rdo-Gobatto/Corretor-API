import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CriarParteLocacaoDto, AlterarParteLocacaoDto, CriarContratoDto } from './locacoes.dto';

describe('validação de locações', () => {
  it('aceita CPF/CNPJ com pontuação e elimina apenas formatação', () => {
    const parte = plainToInstance(CriarParteLocacaoDto, { papel: 'LOCADOR', tipo_pessoa: 'PF', nome: 'Pessoa Teste', cpf_cnpj: '529.982.247-25' });
    expect(validateSync(parte)).toHaveLength(0);
    expect(parte.cpf_cnpj).toBe('52998224725');
    expect(validateSync(plainToInstance(CriarParteLocacaoDto, { ...parte, cpf_cnpj: '11111111111' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(CriarParteLocacaoDto, { ...parte, cpf_cnpj: 'abc52998224725' })).length).toBeGreaterThan(0);
  });
  it('recusa datas impossíveis e nulos nos campos obrigatórios de PATCH', () => {
    expect(validateSync(plainToInstance(AlterarParteLocacaoDto, { nome: null })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(AlterarParteLocacaoDto, { data_nascimento: '2026-02-30' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(AlterarParteLocacaoDto, { data_nascimento: null }))).toHaveLength(0);
  });
  it('recusa valores negativos, vencimento fora do mês e campos de integração enviados pelo cliente', () => {
    const erros = validateSync(plainToInstance(CriarContratoDto, { valor_aluguel: '-1.00', dia_vencimento: 32, url_pasta_drive: 'https://example.com' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(erros.map(erro => erro.property)).toEqual(expect.arrayContaining(['valor_aluguel', 'dia_vencimento', 'url_pasta_drive']));
  });
});
