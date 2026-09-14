import { Imovel } from './imovel.entity';
import { ImovelMidia } from '../midias/imovel-midia.entity';

export function resposta_midia(midia: ImovelMidia) {
  return { id: midia.id, imovel_id: midia.imovel_id, tipo: midia.tipo, url: midia.url, ordem: midia.ordem, capa: midia.capa, criado_em: midia.criado_em, alterado_em: midia.alterado_em };
}

export function resposta_imovel(imovel: Imovel) {
  return {
    id: imovel.id, titulo: imovel.titulo, slug: imovel.slug, tipo_id: imovel.tipo_id, finalidade_id: imovel.finalidade_id,
    tipo: imovel.tipo ? { id: imovel.tipo.id, nome: imovel.tipo.nome, slug: imovel.tipo.slug } : null,
    finalidade: imovel.finalidade ? { id: imovel.finalidade.id, nome: imovel.finalidade.nome, slug: imovel.finalidade.slug } : null,
    valor: imovel.valor, valor_condominio: imovel.valor_condominio, valor_iptu: imovel.valor_iptu,
    area_util: imovel.area_util, area_total: imovel.area_total, cep: imovel.cep, logradouro: imovel.logradouro,
    numero: imovel.numero, complemento: imovel.complemento, bairro: imovel.bairro, cidade: imovel.cidade,
    estado: imovel.estado, descricao: imovel.descricao, status: imovel.status, ativo: imovel.ativo,
    corretor_id: imovel.corretor_id,
    corretor: imovel.corretor ? { id: imovel.corretor.id, nome: imovel.corretor.nome, whatsapp: imovel.corretor.whatsapp, creci: imovel.corretor.creci, url_foto: imovel.corretor.url_foto } : null,
    midias: [...(imovel.midias ?? [])].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id)).map(resposta_midia),
    caracteristicas: (imovel.caracteristicas ?? []).filter((vinculo) => vinculo.ativo && vinculo.caracteristica?.ativo).map((vinculo) => ({ caracteristica_id: vinculo.caracteristica_id, nome: vinculo.caracteristica.nome, icone: vinculo.caracteristica.icone, valor: vinculo.valor })),
    criado_em: imovel.criado_em, alterado_em: imovel.alterado_em,
  };
}
