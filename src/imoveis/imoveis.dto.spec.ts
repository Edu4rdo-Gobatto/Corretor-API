import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AtualizarImovelDto, CriarImovelDto, ConsultaImoveisDto } from './imoveis.dto';

describe('DTOs de imóveis', () => {
  it('permite PATCH vazio mas rejeita null em campos obrigatórios', async () => {
    expect(await validate(plainToInstance(AtualizarImovelDto, {}))).toHaveLength(0);
    const erros = await validate(plainToInstance(AtualizarImovelDto, { titulo: null, ativo: null }));
    expect(erros.map((erro) => erro.property).sort()).toEqual(['ativo', 'titulo']);
  });

  it('rejeita precisão monetária maior que centavos e tags duplicadas', async () => {
    const dto = plainToInstance(CriarImovelDto, { valor: '1.001', caracteristicas: [
      { caracteristica_id: '86e8e2b2-7611-4a2d-8d08-c4d0aabf11d3' },
      { caracteristica_id: '86e8e2b2-7611-4a2d-8d08-c4d0aabf11d3' },
    ] });
    const erros = await validate(dto);
    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['valor', 'caracteristicas']));
  });

  it('consulta pública não permite controlar status e limita paginação', async () => {
    const erros = await validate(plainToInstance(ConsultaImoveisDto, { status: 'CONCLUIDO', limite: '101' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['status', 'limite']));
  });
});
