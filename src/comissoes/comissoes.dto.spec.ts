import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AlterarComissaoDto, CriarComissaoDto, PagarParcelaDto } from './comissoes.dto';

describe('entrada de comissões', () => {
  it('exige confirmação explícita e referência do comprovante de pagamento', () => {
    expect(validateSync(plainToInstance(PagarParcelaDto, { confirmar_pagamento: true, observacao_pagamento: ' PIX comprovante 321 ' }))).toHaveLength(0);
    for (const confirmar_pagamento of [false, 'true', null, undefined]) {
      expect(validateSync(plainToInstance(PagarParcelaDto, { confirmar_pagamento, observacao_pagamento: 'comprovante' })).length).toBeGreaterThan(0);
    }
    expect(validateSync(plainToInstance(PagarParcelaDto, { confirmar_pagamento: true, observacao_pagamento: '     ' })).length).toBeGreaterThan(0);
  });
  it('não permite alterar valores/parcelas nem inserir data de pagamento por PATCH', () => {
    const erros = validateSync(plainToInstance(AlterarComissaoDto, { valor_total: '0.01', quantidade_parcelas: 1, pago_em: '2020-01-01' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(erros.map(e => e.property)).toEqual(expect.arrayContaining(['valor_total', 'quantidade_parcelas', 'pago_em']));
  });
  it('rejeita precisão monetária incorreta e vencimento impossível', () => {
    const erros = validateSync(plainToInstance(CriarComissaoDto, { valor_total: 100.123, primeiro_vencimento: '2026-02-30' }));
    expect(erros.map(e => e.property)).toEqual(expect.arrayContaining(['valor_total', 'primeiro_vencimento']));
  });
});
