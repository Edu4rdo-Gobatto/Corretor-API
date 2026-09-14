import { distribuirParcelas, vencimentoMensal } from './parcelamento';

describe('parcelamento da receita imobiliária', () => {
  it('distribui todos os centavos sem perda nem arredondamento binário', () => {
    expect(distribuirParcelas('100.00', 3)).toEqual(['33.34', '33.33', '33.33']);
    expect(distribuirParcelas('9999999999.99', 2)).toEqual(['5000000000.00', '4999999999.99']);
  });
  it('recusa parcelas de zero centavos e valores inválidos', () => {
    for (const valor of ['0.00', '-1.00', '1.001', 'NaN', '10000000000.00']) {
      expect(() => distribuirParcelas(valor, 1)).toThrow();
    }
    expect(() => distribuirParcelas('0.01', 2)).toThrow();
    expect(() => distribuirParcelas('1.00', 0)).toThrow();
  });
  it('preserva o dia original após fevereiro e trata ano bissexto', () => {
    expect([0, 1, 2].map(m => vencimentoMensal('2028-01-31', m))).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
    expect(vencimentoMensal('2027-01-30', 1)).toBe('2027-02-28');
    expect(vencimentoMensal('2027-12-31', 2)).toBe('2028-02-29');
    expect(() => vencimentoMensal('2027-02-30', 1)).toThrow();
  });
});
