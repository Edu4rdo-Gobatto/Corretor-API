import { dataCivilValida, decimalEmCentavos, documentoValido, telefoneValido } from './validacao';

describe('validação de dados brasileiros', () => {
  it.each(['52998224725', '11222333000181'])('aceita documento com dígitos verificadores válidos: %s', valor => {
    expect(documentoValido(valor)).toBe(true);
  });
  it.each(['11111111111', '52998224726', '11222333000180', '123', ''])('rejeita documento inválido: %s', valor => {
    expect(documentoValido(valor)).toBe(false);
  });
  it.each(['66999999999', '6633334444', '5566999999999', '+55 (66) 99999-9999'])('aceita telefone nacional: %s', valor => {
    expect(telefoneValido(valor)).toBe(true);
  });
  it.each(['00000000000', '99999', '+1 555 999 9999', '66999999999abc'])('rejeita telefone inválido: %s', valor => {
    expect(telefoneValido(valor)).toBe(false);
  });
  it('valida calendário e mantém centavos exatos no limite de numeric(12,2)', () => {
    expect(dataCivilValida('2028-02-29')).toBe(true);
    expect(dataCivilValida('2026-02-29')).toBe(false);
    expect(dataCivilValida('2026-04-31')).toBe(false);
    expect(decimalEmCentavos('9999999999.99')).toBe(999999999999n);
    expect(() => decimalEmCentavos('1.001')).toThrow();
    expect(() => decimalEmCentavos('-1.00')).toThrow();
  });
});
