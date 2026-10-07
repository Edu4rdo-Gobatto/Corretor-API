import { EntityManager } from 'typeorm';
import { Caracteristica, FinalidadeImovel, ImovelCaracteristica, TipoImovel } from '../cadastros/cadastros.entity';
import { CriarCadastroDto, CriarCaracteristicaDto } from '../cadastros/cadastros.dto';
import { CadastrosService, gerar_slug } from '../cadastros/cadastros.service';
import { UsuarioAutenticado } from '../comum/usuario-autenticado';
import { Imovel } from '../imoveis/imovel.entity';
import { CriarImovelDto } from '../imoveis/imoveis.dto';
import { ImovelMidia, TipoMidia } from '../midias/imovel-midia.entity';
import { catalogoCarga, caracteristicasCarga, ItemCatalogoCarga } from './seed-catalogo-dados';
import { exigir, hash, validarDto } from './seed-catalogo-arquivos';
import { ItemPrivado, LOTE } from './seed-catalogo-journal';

export async function referencias(manager: EntityManager, executar: boolean, usuario: UsuarioAutenticado, contagens: { cadastros_faltantes: number }) {
  const tipos = new Map<string, number>(); const finalidades = new Map<string, number>(); const caracteristicas = new Map<string, number>();
  const servico = new CadastrosService(manager.getRepository(TipoImovel), manager.getRepository(FinalidadeImovel), manager.getRepository(Caracteristica));
  let provisoria = 1_000_000;
  for (const [categoria, classe, slugs, mapa] of [
    ['tipos-imovel', TipoImovel, [...new Set(catalogoCarga.map(i => i.tipo_slug))], tipos],
    ['finalidades-imovel', FinalidadeImovel, [...new Set(catalogoCarga.map(i => i.finalidade_slug))], finalidades],
  ] as const) {
    for (const slug of slugs) {
      const registro = await manager.getRepository(classe).findOneBy({ slug });
      if (registro) { exigir(registro.ativo, 'Tipo ou finalidade preexistente inativo; reativação automática recusada.'); mapa.set(slug, registro.id); }
      else {
        contagens.cadastros_faltantes++;
        const nome = slug.replace(/-/g, ' ');
        const dto = validarDto(CriarCadastroDto, { nome: nome[0].toUpperCase() + nome.slice(1), slug });
        mapa.set(slug, executar ? (await servico.criar(categoria, dto, usuario)).id : provisoria++);
      }
    }
  }
  for (const definicao of caracteristicasCarga) {
    const registro = await manager.getRepository(Caracteristica).findOneBy({ nome: definicao.nome });
    if (registro) { exigir(registro.ativo, 'Característica preexistente inativa; reativação automática recusada.'); caracteristicas.set(definicao.nome, registro.id); }
    else {
      contagens.cadastros_faltantes++;
      const dto = validarDto(CriarCaracteristicaDto, definicao);
      caracteristicas.set(definicao.nome, executar ? (await servico.criar('caracteristicas', dto, usuario)).id : provisoria++);
    }
  }
  return { tipos, finalidades, caracteristicas };
}

export function montarDto(item: ItemCatalogoCarga, ids: Awaited<ReturnType<typeof referencias>>, corretor: number): CriarImovelDto {
  return validarDto(CriarImovelDto, { ...item.dados, tipo_id: ids.tipos.get(item.tipo_slug), finalidade_id: ids.finalidades.get(item.finalidade_slug), corretor_id: corretor, ativo: false,
    observacoes_internas: `carga:${LOTE}:${item.chave}`, caracteristicas: item.caracteristicas.map(c => ({ caracteristica_id: ids.caracteristicas.get(c.nome), valor: c.valor })) });
}

function dadosEscalares(manager: EntityManager, imovel: Imovel, dto?: CriarImovelDto): Record<string, unknown> {
  const dados: Record<string, unknown> = {};
  const fonte = dto as unknown as Record<string, unknown> | undefined;
  for (const coluna of manager.getRepository(Imovel).metadata.columns) {
    const campo = coluna.propertyName;
    if (['id', 'criado_em', 'alterado_em'].includes(campo)) continue;
    let valor: unknown = fonte ? fonte[campo] : coluna.getEntityValue(imovel);
    if (fonte && campo === 'slug') valor = `${gerar_slug(dto!.titulo)}-${imovel.id}`;
    if (fonte && ['criado_por', 'alterado_por'].includes(campo)) valor = 1;
    valor ??= coluna.default ?? null;
    if (coluna.type === 'numeric' && valor !== null) valor = Number(valor).toFixed(2);
    dados[campo] = valor;
  }
  return dados;
}

export async function fingerprint(manager: EntityManager, imovel: Imovel, dto?: CriarImovelDto): Promise<string> {
  const vinculos = dto?.caracteristicas?.map(c => ({ id: c.caracteristica_id, valor: c.valor ?? null, ativo: true, criado_por: 1, alterado_por: 1 }))
    ?? (await manager.getRepository(ImovelCaracteristica).findBy({ imovel_id: imovel.id })).map(c => ({ id: c.caracteristica_id, valor: c.valor, ativo: c.ativo, criado_por: c.criado_por, alterado_por: c.alterado_por }));
  return hash(JSON.stringify({ dados: dadosEscalares(manager, imovel, dto), caracteristicas: vinculos.sort((a, b) => a.id - b.id) }));
}

export async function snapshot(manager: EntityManager, imovel: Imovel): Promise<string> {
  return hash(`${await fingerprint(manager, imovel)}:${imovel.criado_em.toISOString()}:${imovel.alterado_em.toISOString()}`);
}

export async function midiasBanco(manager: EntityManager, id: number): Promise<ImovelMidia[]> {
  return manager.getRepository(ImovelMidia).createQueryBuilder('midia').addSelect('midia.chave_armazenamento').where('midia.imovel_id = :id', { id }).orderBy('midia.ordem', 'ASC').addOrderBy('midia.id', 'ASC').getMany();
}

export function conferirGaleria(midias: ImovelMidia[], item: ItemPrivado, id: number, fontes: readonly string[], urlBase?: string): void {
  exigir(midias.length === 3, 'Galeria incompleta ou divergente; nenhuma mídia será sobrescrita.');
  midias.forEach((midia, indice) => {
    const foto = item.fotos[indice];
    exigir(midia.tipo === TipoMidia.IMAGEM && midia.ordem === indice && midia.capa === (indice === 0) && midia.criado_por === 1 && midia.alterado_por === 1
      && midia.chave_armazenamento?.startsWith(`imoveis/${id}/`) && midia.chave_armazenamento === foto.chave
      && (midia.url === fontes[indice] || (urlBase !== undefined && midia.url === `${urlBase}/${foto.chave}`)), 'Metadados de mídia divergem da carga.');
  });
}

/** O bucket atual não permite leitura pública; as imagens licenciadas ficam referenciadas pela CDN de origem. */
export async function publicarFontesDaGaleria(manager: EntityManager, midias: ImovelMidia[], item: ItemPrivado, id: number, fontes: readonly string[], urlBase: string): Promise<void> {
  conferirGaleria(midias, item, id, fontes, urlBase);
  const repositorio = manager.getRepository(ImovelMidia);
  for (const [indice, midia] of midias.entries()) {
    const esperada = `${urlBase}/${item.fotos[indice].chave}`;
    if (midia.url === esperada) {
      const resultado = await repositorio.update({ id: midia.id, imovel_id: id, url: esperada }, { url: fontes[indice] });
      exigir(resultado.affected === 1, 'Referência da foto mudou durante a publicação.');
    }
  }
  conferirGaleria(await midiasBanco(manager, id), item, id, fontes);
}
