# Auditoria de backend — 11/09/2026 (status em 09/10/2026)

> A auditoria de 11/09 analisou o MVP em inglês (`auth`, `agents`, `properties`, `leads`, `media`) e deu nota 7,3/10:
> 0 achados críticos, 0 altos, 9 médios e 10 baixos. O relatório completo está no Git.
> O código foi refeito em português depois disso. O status abaixo foi conferido no código atual em 09/10/2026.
> A auditoria full stack posterior, de 02/10, está em
> [Corretor-web/docs/2026-10-02-auditoria-fullstack.md](../../Corretor-web/docs/2026-10-02-auditoria-fullstack.md).

Status: **resolvido**, **resolvido em parte**, **pendente** ou **decisão contrária**.

| Id | Nível | Achado em 11/09 | Status | Evidência atual |
|---|---|---|---|---|
| SEC-01 | médio | Slug público sem validação de formato e tamanho | resolvido | `ImoveisService.encontrar_publico` exige `^[a-z0-9-]{1,240}$` (400) e busca pelo id no fim do slug |
| SEC-02 | médio | Limite de login em memória não escala com várias instâncias | pendente | `TentativasGuard` segue em memória; aceito para instância única (SEC-002 em TASKS) |
| SEC-03 | médio | Formulário público de contato sem limite | resolvido | `LimitePessoasGuard`: 5 envios por minuto por IP |
| SEC-04 | médio | Sem headers de segurança (Helmet) | resolvido | `helmet()` no `main.ts` |
| SEC-05 | baixo | `features` em JSON livre | resolvido | virou a relação `caracteristicas` / `imoveis_caracteristicas` |
| SEC-06 | baixo | Dados pessoais de contatos sem criptografia | decisão contrária | 14/09: sem cifra de coluna; proteção por TLS, disco cifrado e autorização |
| DB-01 | médio | Sessões expiradas nunca apagadas | resolvido | `SessoesService` limpa no boot e a cada hora |
| DB-02 | médio | Sem índice na cidade do imóvel | resolvido | índice GIN trigram `busca_imoveis_cidade` na migration `1789603200000` |
| DB-03 | médio | Troca de capa e reordenação sem transação | resolvido | `MidiasService.definir_capa` e `reordenar` rodam em transação com lock do imóvel |
| DB-04 | baixo | Uploads ao R2 em sequência | pendente | o laço de envio continua sequencial (LIMPEZA-API em TASKS) |
| ARQ-01 | médio | Sem filtro global de exceções | resolvido | `GlobalExceptionFilter` em `src/common/filters` |
| ARQ-02 | baixo | Nenhum log na aplicação | resolvido em parte | `Logger` do Nest em 7 arquivos (filtro global, configuração do banco e services); sem log estruturado (LOGS-001 em TASKS) |
| ARQ-03 | baixo | Criação de corretor verifica e depois grava | resolvido | constraint UNIQUE de e-mail; o erro `23505` vira 409 |
| PERF-01 | médio | Upload inteiro em memória | resolvido em parte | limites de tamanho e de lote durante a recepção e cota de 2 uploads simultâneos; sem streaming |
| PERF-02 | baixo | Uploads sequenciais (mesmo ponto de DB-04) | pendente | ver DB-04 |
| PERF-03 | baixo | Listagem carrega todas as mídias | resolvido em parte | mídias só dos imóveis da página, numa consulta separada |
| OPS-01 | médio | Sem health check | resolvido | `GET /api/v1/saude` com `SELECT 1`; conferir o path no Render (DEPLOY-001) |
| OPS-02 | baixo | Cliente do R2 sem timeout | resolvido | `R2_REQUEST_TIMEOUT_MS` e `R2_CONNECTION_TIMEOUT_MS` |
| OPS-03 | baixo | API sem versão | resolvido | prefixo `/api/v1` |
