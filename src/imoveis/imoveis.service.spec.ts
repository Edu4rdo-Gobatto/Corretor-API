import { NotFoundException } from '@nestjs/common';
import { ImoveisService, RESTRICAO_PUBLICA } from './imoveis.service';
import { Imovel, StatusImovel } from './imovel.entity';
import { ConsultaImoveisDto } from './imoveis.dto';

/** `findOne` simulado: o registro precisa bater com todas as chaves do `where`, inclusive as aninhadas (ex.: corretor.ativo). */
const combina = (registro: Record<string, unknown>, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([chave, valor]) => valor !== null && typeof valor === 'object'
    ? combina((registro[chave] ?? {}) as Record<string, unknown>, valor as Record<string, unknown>)
    : registro[chave] === valor);

const imovel = (dados: Partial<Imovel>) => ({
  id: 1, titulo: 'Prédio comercial', slug: 'predio-comercial-1', ativo: true, status: StatusImovel.DISPONIVEL,
  corretor: { id: 7, ativo: true, nome: 'Corretor', whatsapp: null, creci: null, url_foto: null }, midias: [], caracteristicas: [], ...dados,
}) as unknown as Imovel;

function servico(registros: Imovel[] = []) {
  const condicoes: unknown[][] = [];
  const consulta: Record<string, jest.Mock> = {};
  for (const metodo of ['innerJoin', 'andWhere', 'clone', 'select', 'orderBy', 'addOrderBy', 'offset', 'limit']) {
    consulta[metodo] = jest.fn((...argumentos: unknown[]) => { if (metodo === 'andWhere') condicoes.push(argumentos); return consulta; });
  }
  consulta.getCount = jest.fn().mockResolvedValue(0);
  consulta.getRawMany = jest.fn().mockResolvedValue([]);
  const imoveis = {
    createQueryBuilder: jest.fn(() => consulta),
    findOne: jest.fn(({ where }: { where: Record<string, unknown> }) => Promise.resolve(registros.find((registro) => combina(registro as unknown as Record<string, unknown>, where)) ?? null)),
  };
  return { condicoes, imoveis: new ImoveisService(imoveis as never, {} as never, {} as never) };
}

describe('ImoveisService: visibilidade pública', () => {
  it('o site depende só de "Exibir no site" (ativo), não da situação nem do corretor', () => {
    expect(RESTRICAO_PUBLICA).toBe('imovel.ativo = true');
  });

  it('a listagem pública aplica a restrição sem filtrar por situação', async () => {
    const { condicoes, imoveis } = servico();
    await imoveis.listar_publicos({ pagina: 1, limite: 12 } as ConsultaImoveisDto);
    expect(condicoes).toContainEqual([RESTRICAO_PUBLICA]);
    expect(JSON.stringify(condicoes)).not.toMatch(/status|corretor\.ativo/);
  });

  it('abre no site um imóvel vendido de corretor desativado, se estiver ativo', async () => {
    const vendido = imovel({ status: StatusImovel.VENDIDO, corretor: { id: 7, ativo: false } as never });
    const { imoveis } = servico([vendido]);
    await expect(imoveis.encontrar_publico('predio-comercial-1')).resolves.toMatchObject({ id: 1, status: StatusImovel.VENDIDO });
  });

  it('imóvel retirado do site (inativo) continua fora do ar', async () => {
    const { imoveis } = servico([imovel({ ativo: false })]);
    await expect(imoveis.encontrar_publico('predio-comercial-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
