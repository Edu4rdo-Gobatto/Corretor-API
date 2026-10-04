# Contrato v2 — ids inteiros, pessoas unificadas e ficha do imóvel (16/09/2026)

Decisões do dono em 16/09/2026, após o diagnóstico em `docs/plans/2026-09-16-diagnostico-produto.md`:

1. Fotos e vídeos são enviados junto com a criação do imóvel.
2. Aviso de novo contato fica para a próxima rodada (tarefa aberta).
3. Contatos em três listas lado a lado: **Pendentes**, **Respondidos** e **Finalizados**.
4. Uma pessoa é uma pessoa: o lead é só o primeiro contato. O mesmo cadastro serve como
   cliente, proprietário (locador) e inquilino (locatário). Não existem mais `clientes` e
   `partes_locacao` separados.
5. Ficha do imóvel ganha os campos que faltavam, todos opcionais.
6. Catálogo ganha filtros e ordenação.
7. Ids passam a ser **inteiros com autoincremento** em todas as tabelas; nada mais usa UUID.
8. O front usa vocabulário em português de ponta a ponta, sem tradutor.

Este documento é o contrato entre `corretor-api` e `corretor-web`. Vale sobre o handoff de
14/09 onde houver conflito. Prefixo HTTP `/api/v1` mantido; o proxy do front continua em `/api`.

## Identificadores

- Todo `id` é inteiro positivo gerado pelo banco. Parâmetros `:id` inválidos respondem 400.
- O JWT carrega `sub` como texto numérico do id do corretor.
- Slug do imóvel: `<titulo-normalizado>-<id>` (ex.: `galpao-na-br-163-42`). É recalculado quando o
  título muda. `GET /imoveis/:slug` localiza pelo id no final do slug e devolve o slug atual; se o
  slug pedido for diferente, o front redireciona (301 no SSR) para o atual.

## Rotas

| Área | Rotas | Acesso |
|---|---|---|
| Saúde | `GET /saude` | público |
| Sessão | `POST /autenticacao/entrar`, `/renovar`, `/sair`; `GET/PATCH /autenticacao/eu`; `PATCH /autenticacao/eu/senha` | público / JWT |
| Corretores | `GET/POST /admin/corretores`; `GET/PATCH/DELETE /admin/corretores/:id` | ADMIN |
| Classificações | `GET /tipos-imovel`, `/finalidades-imovel`, `/caracteristicas`; CRUD sob `/admin/...` | público / ADMIN |
| Imóveis | `GET /imoveis`, `GET /imoveis/:slug`; `GET/POST /admin/imoveis`; `GET/PATCH/DELETE /admin/imoveis/:id` | público / JWT (dono ou ADMIN escreve) |
| Mídias | `POST /admin/imoveis/:imovel_id/midias` (multipart `arquivos`), `POST .../video-embed`, `PATCH .../ordem`, `PATCH .../:midia_id/capa`, `DELETE .../:midia_id` | dono ou ADMIN |
| **Pessoas** | `POST /pessoas` (público, com consentimento); `GET/POST /admin/pessoas`; `GET/PATCH/DELETE /admin/pessoas/:id` | público / JWT |
| Contratos | `GET/POST /admin/contratos`; `GET/PATCH/DELETE /admin/contratos/:id`; `POST /admin/contratos/:id/pasta-drive` | JWT (regras de 14/09 mantidas) |
| Comissões | `GET/POST /admin/comissoes`; `GET/PATCH/DELETE /admin/comissoes/:id`; `PATCH /admin/comissoes/parcelas/:id/pagamento` | JWT (regras de 14/09 mantidas) |

Removidas: `POST /clientes`, `/admin/clientes/*`, `/admin/partes-locacao/*`.

Listagens respondem `{ itens, total, pagina, limite, total_paginas }` em todas as áreas.
`DELETE` desativa (`ativo=false`) e responde 204, exceto mídia, que é excluída de fato.

## Pessoa

Campos devolvidos: `id, nome, telefone, email, tipo_pessoa (PF|PJ|null), cpf_cnpj, data_nascimento,
endereco, banco_nome, banco_agencia, banco_conta, chave_pix, observacoes, mensagem, imovel_id,
corretor_id, origem (SITE|MANUAL), status_contato (PENDENTE|RESPONDIDO|FINALIZADO), consentimento,
consentimento_em, versao_termos, ativo, criado_em, alterado_em`. O IP do consentimento fica só no banco.

- `POST /pessoas` (site): `{ imovel_id, nome, telefone, email?, mensagem?, consentimento: true }` → `201 { id }`.
  Exige imóvel ativo e disponível; grava origem `SITE`, `status_contato = PENDENTE`, IP, data e versão dos termos.
  Limite de 5 envios por minuto por IP.
- `POST /admin/pessoas`: todos os campos acima exceto os de consentimento e `origem`; `corretor_id`
  só para ADMIN (padrão: quem cadastra); `status_contato` padrão `RESPONDIDO`.
- `PATCH /admin/pessoas/:id`: qualquer campo acima e `ativo`.
- `GET /admin/pessoas`: `pagina, limite, busca` (nome, telefone, e-mail ou CPF/CNPJ), `status_contato`,
  `imovel_id`, `corretor_id` (ADMIN), `ativo` (`true|false`), `criado_desde`, `criado_ate`, `id`.
  Ordem: mais recentes primeiro.
- Visibilidade: ADMIN vê todas; corretor vê as pessoas sob sua responsabilidade e as vinculadas a
  contratos que intermedeia. Escrita segue a mesma regra.
- Validação: `cpf_cnpj` válido e coerente com `tipo_pessoa` quando os dois existem; se só o documento
  vier, o tipo é deduzido (11 dígitos PF, 14 PJ). `data_nascimento` só para PF e no passado.
- Regras de contrato e comissão continuam iguais às de 14/09, apenas apontando para `pessoas`:
  locador e locatário são pessoas ativas distintas; comissão exige pessoa e imóvel com o mesmo
  corretor responsável.

## Imóvel

Campos públicos: `id, titulo, slug, tipo_id, finalidade_id, tipo {id,nome,slug}, finalidade {id,nome,slug},
valor_venda, valor_locacao, valor_condominio, valor_iptu, area_util, area_total, cep, logradouro, numero,
complemento, bairro, cidade, estado, descricao, status, destaque, ativo, corretor_id, corretor
{id,nome,whatsapp,creci,url_foto}, midias[], caracteristicas[], criado_em, alterado_em`.

Campos internos (só nas rotas `/admin`): `proprietario_id, proprietario {id,nome} | null, exclusividade,
exclusividade_ate, data_captacao, chaves, matricula, inscricao_municipal, observacoes_internas, motivo_baixa`.

- `valor` deixa de existir. `valor_venda` e `valor_locacao` são decimais opcionais (texto com duas
  casas); os dois vazios significam "sob consulta".
- `status`: `DISPONIVEL | RESERVADO | VENDIDO | ALUGADO | RETIRADO`. Só `DISPONIVEL` aparece no site.
  `CONCLUIDO` foi convertido em `VENDIDO` ou `ALUGADO` conforme a finalidade.
- `destaque` (boolean, padrão falso) marca o imóvel para a vitrine.
- Valores monetários e áreas continuam como texto decimal no JSON.
- `GET /imoveis` e `GET /admin/imoveis`: `pagina, limite, tipo_id, finalidade_id, cidade, bairro, busca`
  (título, bairro, cidade e descrição; `#12` ou número puro busca pelo id), `valor_min, valor_max,
  area_min, area_max` (área útil), `destaque`, `ordenar` (`recentes | valor_asc | valor_desc |
  area_asc | area_desc`; padrão `recentes`). Interno acrescenta `status, ativo, corretor_id, proprietario_id, id`.
- Coluna de preço usada em filtro e ordenação: com `finalidade_id` de venda, `valor_venda`; de locação,
  `valor_locacao`; caso contrário `COALESCE(valor_venda, valor_locacao)`. Nulos ficam por último.

## Contrato e comissão

- `contrato.locador_id` e `contrato.locatario_id` apontam para `pessoas`. As respostas de contrato
  incluem `imovel_titulo`, `locador_nome` e `locatario_nome`.
- `comissao.cliente_id` passa a `pessoa_id` (também no filtro da listagem).

## Migração

`1789603200000-ids-inteiros-pessoas.ts`, aditiva sobre `1789516800000`. Move as tabelas atuais para o
schema `legado_20260916`, recria as tabelas em `public` com ids inteiros, copia os dados mapeando os
UUIDs, funde `clientes` e `partes_locacao` em `pessoas`, converte `valor` e `status` conforme a
finalidade e ajusta as chaves de `pastas_drive`. `down` recusa reversão, como a anterior. Execução
manual, com backup, pelos comandos `npm run migration:*` já existentes. Tokens de acesso antigos
deixam de valer (o `sub` muda); os cookies de renovação são preservados.
