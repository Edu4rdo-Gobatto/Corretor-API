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
    const dto = plainToInstance(CriarImovelDto, { valor_venda: '1.001', caracteristicas: [{ caracteristica_id: 5 }, { caracteristica_id: 5 }] });
    const erros = await validate(dto);
    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['valor_venda', 'caracteristicas']));
  });

  it('aceita ficha interna opcional e ids inteiros como texto na query', async () => {
    const dto = plainToInstance(CriarImovelDto, { proprietario_id: 3, exclusividade: true, exclusividade_ate: '2027-01-31', chaves: 'Com o zelador', matricula: null });
    expect((await validate(dto)).map((erro) => erro.property)).not.toEqual(expect.arrayContaining(['proprietario_id', 'exclusividade', 'exclusividade_ate', 'chaves', 'matricula']));
    const consulta = plainToInstance(ConsultaImoveisDto, { tipo_id: '2', ordenar: 'valor_asc', area_min: '50', destaque: 'true' });
    expect(await validate(consulta)).toHaveLength(0);
    expect(consulta).toMatchObject({ tipo_id: 2, ordenar: 'valor_asc', area_min: '50', destaque: true });
    expect((await validate(plainToInstance(ConsultaImoveisDto, { tipo_id: 'abc', ordenar: 'aleatorio' }))).map((erro) => erro.property).sort()).toEqual(['ordenar', 'tipo_id']);
  });

  it('consulta pública não permite controlar status e limita paginação', async () => {
    const erros = await validate(plainToInstance(ConsultaImoveisDto, { status: 'CONCLUIDO', limite: '101' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['status', 'limite']));
  });
});
