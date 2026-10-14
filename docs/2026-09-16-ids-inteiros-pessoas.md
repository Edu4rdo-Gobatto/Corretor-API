# Contrato v2 — ids inteiros e pessoas unificadas, 16/09/2026 (resumo histórico)

> Documento histórico, resumido em 09/10/2026; o texto completo está no Git.
> O contrato atual está no [README](README.md) (rotas e convenções) e no
> [ENTENDENDO-O-BACKEND](ENTENDENDO-O-BACKEND.md) (regras por módulo).

## O que introduziu

Decisões do dono em 16/09, commit `0140947`, migration `1789603200000-ids-inteiros-pessoas`:

- Ids inteiros gerados pelo banco em todas as tabelas. O JWT carrega `sub` como texto numérico.
- Slug `<titulo-normalizado>-<id>`, recalculado com o título. `GET /imoveis/:slug` acha pelo id no fim e devolve o
  slug atual; o SSR do front redireciona com 301.
- Tabela única `pessoas`: o contato do site, o cliente, o proprietário e o inquilino são o mesmo cadastro, com
  `status_contato` `PENDENTE`, `RESPONDIDO` ou `FINALIZADO`.
- Imóvel com `valor_venda` e `valor_locacao` opcionais (os dois vazios significam "sob consulta"), `destaque`,
  status `DISPONIVEL | RESERVADO | VENDIDO | ALUGADO | RETIRADO` e ficha interna só nas rotas `/admin`.
- Catálogo com `bairro`, `area_min`, `area_max`, `destaque`, `ordenar` e busca por `#id`.
- Listagens com `total_paginas` em todas as áreas; `DELETE` responde 204, exceto o de corretor.
- A migration arquiva o modelo anterior em `legado_20260916` e recusa reversão.

## O que mudou depois

| Em 16/09 | Hoje |
|---|---|
| `tipo_id` com um id só | Um id ou CSV de até 20 (09/10) |
| Sem rotas de foto e de pessoas elegíveis | `GET /corretores/:id/foto` (06/10) e `GET /admin/comissoes/pessoas-elegiveis` (09/10) |
| `PATCH /autenticacao/eu` só JSON | Também multipart com o campo `foto` (06/10) |
| Filtros internos: `status`, `ativo`, `corretor_id`, `proprietario_id`, `id` | Mais `apenas_disponiveis` e `sem_contrato_ativo`, e `ativo=true` por padrão (04/10) |
| Migração com cópia dos dados antigos | Banco recriado vazio em 17/09; a cópia percorreu zero linhas |
