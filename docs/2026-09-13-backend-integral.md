# Pedido integral do backend — 13/09/2026 (resumo histórico)

> Documento histórico. O pedido original foi resumido em 09/10/2026; o texto completo está no Git.
> O estado atual está no [README](README.md) e no [ENTENDENDO-O-BACKEND](ENTENDENDO-O-BACKEND.md).

## O que introduziu

Pedido do dono para refazer a API, implementado em 14/09 ([entrega](2026-09-14-backend-portugues.md)):

- Nomes em português de ponta a ponta: tabelas, colunas, enums, DTOs e rotas.
- Exclusão lógica com `ativo` em todas as entidades de negócio. Só a mídia é apagada de fato, do R2 e do banco.
- Auditoria em todas as tabelas: `criado_em`, `alterado_em`, `criado_por`, `alterado_por`.
- Dados pessoais sem criptografia de coluna, para manter índices e buscas.
- Fim de `rental_documents` e `rent_payments`: documentos vão para o Google Drive e o sistema não faz repasse mensal.
- Tipos, finalidades e características como cadastros dinâmicos, com tabela de ligação relacional.
- Um contrato ATIVO por imóvel, por índice único parcial; contrato vira INATIVO depois de `data_fim`.
- Comissão como receita da imobiliária, com parcelas que viram ATRASADO sozinhas e baixa manual com comprovante.
- Advisory lock para impedir rebaixar ou desativar o último ADMIN.
- Todo corretor autenticado lê todos os imóveis internos; só o responsável ou ADMIN altera.

## O que foi substituído

| No pedido | Hoje |
|---|---|
| Ids UUID | Ids inteiros (16/09, [contrato v2](2026-09-16-ids-inteiros-pessoas.md)) |
| Tabelas `clientes` e `partes_locacao` | Tabela única `pessoas` (16/09) |
| `imoveis.valor` e status `CONCLUIDO` | `valor_venda`, `valor_locacao` e status `VENDIDO`, `ALUGADO`, `RETIRADO` (16/09) |
| Slug com UUID | Slug `<titulo>-<id>` (16/09) |
| Sessão de 30 dias com rotação | Sessão de 4h por inatividade, sem rotação (06/10) |
| Fase final com testes Jest | Sem suítes desde 03/10 |
