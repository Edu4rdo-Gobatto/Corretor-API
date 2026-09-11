# Histórico de trabalho dos agentes — corretor-api

Registro objetivo, do mais recente para o mais antigo. Cada entrada traz tarefa, alterações,
testes com resultado real e pendências.

## 2026-09-11 — Claude (infraestrutura e homologação)

Tarefa: INFRA-001 — criar e homologar Neon e Cloudflare R2; conferir o parecer da sessão anterior contra o repositório.

Alterações em código: nenhuma. Alterações em arquivos versionados: criação da camada de contexto
(`AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `DECISIONS.md`, `TASKS.md`, `CHANGELOG_AI.md`, `docs/handoffs/`).

Ações fora do repositório:

- `.env` local preenchido com Neon e R2; `JWT_SECRET` gerado; `DATABASE_URL` duplicado corrigido; permissão `600`.
- 5 migrations aplicadas no Neon (`migration:run`), criando 6 tabelas com a de controle.
- Primeiro ADMIN criado (`bootstrap:admin`), id `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f`; variáveis `BOOTSTRAP_*` removidas do `.env`.
- Dois backups gerados em `backups/` com `pg_dump` 16 via Docker (após migrations e após homologação).

Testes executados:

- `npm ci`: ok, 0 vulnerabilidades.
- `npm test`: 13 suítes, 130 testes aprovados.
- `npm run lint`, `npm run typecheck`, `npm run build`: sem erro.
- Teste ponta a ponta com Neon e R2 reais, pelo proxy do front: 25 passos aprovados, cobrindo login com cookie de
  refresh, recusa de origem não autorizada (403), criação de imóvel, upload de 3 imagens ao R2 com leitura pública,
  definição de capa, exclusão com remoção do objeto no R2, detalhe público, página SSR com JSON-LD e `og:image`,
  lead sem consentimento (400) e com consentimento (201), e limpeza completa.

Achados:

- O commit `accd5d9` citado no parecer anterior **não existe** no GitHub nem nesta máquina; foi procurado em `main`,
  `shura`, commits soltos, stash, reflog, tags, forks e PRs. As funcionalidades de segurança que ele traria não estão no código.
- A API tem 130 testes, não os 144 citados no parecer.
- A Cloudflare responde 403 ao User-Agent `Python-urllib` na URL pública do R2. Não é configuração do bucket:
  com Node, curl ou navegador a mesma URL responde 200.
- `pg_dump` e `psql` não estão instalados na máquina; usamos a imagem Docker `postgres:16`.

Pendências:

- SEC-001: recuperar o `accd5d9` com o autor.
- ADMIN-001: o WhatsApp do administrador ficou com o número de exemplo.
- DEPLOY-001: publicação ainda não iniciada; pesquisa de Render e Vercel em andamento.
- Ficaram duas sessões de refresh dos logins de teste na tabela `refresh_sessions`; expiram em 30 dias (OPS-001).

## 2026-09-11 — Claude (análise do repositório)

Tarefa: mapear o que está implementado e comparar com `corretor-spec.json`, sem alterar código.

Resultado: 256 itens da especificação conformes, 11 divergentes, 2 parciais, nenhum ausente, 78 extras e
37 fora do código (contas, deploy e processo). As divergências estão listadas em
`docs/handoffs/2026-09-11-infra-neon-r2.md`.

Testes executados: nenhum nesta etapa; análise somente de leitura.

## Registros anteriores

O trabalho anterior a 11/09/2026 está nos commits do Git e no `PLANO-PROJETO-CORRETOR.md`.
Não havia registro por agente antes desta data.
