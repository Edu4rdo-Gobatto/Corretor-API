# Backend em português — entrega de 14/09/2026 (resumo histórico)

> Documento histórico, resumido em 09/10/2026; o texto completo está no Git.
> O estado atual está no [README](README.md) e no [ENTENDENDO-O-BACKEND](ENTENDENDO-O-BACKEND.md).

## O que introduziu

Implementação do [pedido integral de 13/09](2026-09-13-backend-integral.md), commit `f5bd264`:

- Rotas em português sob `/api/v1`, com compatibilidade sem prefixo para o proxy do front.
- Listagens no formato `itens`, `total`, `pagina`, `limite`.
- Login com `{ email, senha }` e cookie `corretor_renovacao` Secure, HttpOnly e SameSite=Strict.
- Comissões com até 600 parcelas, centavos restantes nas primeiras, vencimentos 29–31 ajustados ao fim do mês e
  baixa idempotente com comprovante de 5 caracteres ou mais.
- Crons de hora em hora no fuso `America/Cuiaba` para contratos vencidos e parcelas atrasadas.
- Integração com o Google Drive compartilhado por Service Account, com id de pasta reservado e retentativa.
- Executor próprio de migrations, sem imprimir SQL, com `MIGRACAO_BACKUP_ARQUIVO`.
- Migration `1789516800000-modelo-portugues`: move o modelo anterior para `legado_20260913`, lê complementos de
  `MIGRACAO_COMPLEMENTOS_ARQUIVO`, decifra o legado com `LEADS_ENCRYPTION_KEY` e recusa reversão.

## O que foi substituído

| Na entrega | Hoje |
|---|---|
| Ids UUID; rotas `/clientes`, `/admin/clientes`, `/admin/partes-locacao` | Ids inteiros e `/pessoas`, `/admin/pessoas` (16/09) |
| `cliente_id` na comissão | `pessoa_id` (16/09) |
| Sessão consumida a cada renovação | Token fixo; renovar só estende o prazo (06/10) |
| Troca e reset de senha mantêm as sessões | Troca, reset pelo ADMIN e desativação revogam (16/09 e 02/10) |
| Crons no minuto 0 | Contratos em `0 * * * *`, comissões em `5 * * * *` |
| Corte coordenado do banco publicado com complementos reais | Banco zerado e recriado com as 10 migrations (17/09) |
| Front ainda no contrato antigo | Front adaptado ao contrato v2 |

Regras do Drive e das comissões que continuam valendo foram levadas ao README e ao ENTENDENDO.
