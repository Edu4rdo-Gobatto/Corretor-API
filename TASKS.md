# Tarefas — corretor-api

Status possíveis: `aberta`, `em andamento`, `em revisão`, `bloqueada`, `concluída`.
Quem assume uma tarefa escreve o próprio nome em Responsável e reflete isso no `PROJECT_STATUS.md`.
Tarefas do front ficam em `../Corretor-web/TASKS.md`.

---

## SEC-001 — Recuperar o commit `accd5d9` ("segurança e operações")

Status: bloqueada
Responsável: SHURIKA6 (autor do commit)
Revisor: Claude

Objetivo:

Trazer para o GitHub a rodada de segurança que existe apenas na cópia local do autor, e revalidá-la
contra o banco real. Segundo o parecer da sessão anterior, ela inclui Helmet, health check, rate limit de
criação de leads, criptografia AES-256-GCM dos dados pessoais de leads, filtro global de exceções,
compatibilidade com o prefixo `/api/v1` e transações nas operações de mídia.

Critérios de conclusão:

- `git push` do commit para a `main` ou para uma branch do repositório remoto.
- `npm ci && npm test && npm run lint && npm run typecheck && npm run build` passando na cópia sincronizada.
- Conferir se a rodada acrescenta migrations. Se acrescentar, aplicar no Neon com backup antes.
- Se ela **alterar** migration já aplicada, parar e decidir com o dono do projeto: o banco atual já tem o schema e o administrador.
- Se a criptografia de leads exigir variável nova (por exemplo, uma chave AES), registrar em `DECISIONS.md` e no `.env.example`.
- Revisão do Claude registrada em `CHANGELOG_AI.md`.

Se o commit estiver perdido, abrir SEC-002 para reimplementar item a item.

---

## DEPLOY-001 — Publicar a API

Status: aberta
Responsável: —
Revisor: —

Objetivo:

Colocar a API no ar com as variáveis reais, apontando para o Neon e o R2 já configurados.

Critérios de conclusão:

- Serviço criado, com Node 24, `npm ci && npm run build` no build e `npm run start:prod` no start.
- Variáveis configuradas: `DATABASE_URL`, `JWT_SECRET` (novo, diferente do de desenvolvimento), `JWT_EXPIRES_IN`,
  as quatro `R2_*`, `NODE_ENV=production` e `ALLOWED_ORIGINS` com o domínio real do front.
- A aplicação escuta na porta informada pela plataforma, em `0.0.0.0`.
- `GET /properties` responde 200 no domínio público.
- Login pelo front publicado grava o cookie de refresh e o painel abre.
- Decidir o que fazer quanto ao cold start e registrar em `DECISIONS.md`.
- Sem rota de health, escolher a rota que a plataforma usará para verificação e registrar a escolha.

Dependências: a pesquisa de deploy iniciada em 11/09 precisa ser concluída e incorporada aqui.

---

## ADMIN-001 — Corrigir o WhatsApp do administrador

Status: aberta
Responsável: —

Objetivo:

O ADMIN `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f` foi criado com o número de exemplo `5565999999999`,
que aparece no botão de WhatsApp dos imóveis.

Critérios de conclusão:

- Número real gravado, via painel em `/admin/corretores` ou `PATCH /agents/:id` com token de ADMIN.
- Conferir na página pública de um imóvel que o link `wa.me` usa o número correto.

---

## OPS-001 — Limpeza periódica de sessões expiradas

Status: aberta
Responsável: —

Objetivo:

A tabela `refresh_sessions` acumula linhas expiradas; não existe rotina de limpeza no código.

Critérios de conclusão:

- Definir e registrar como a limpeza será feita (`DELETE FROM refresh_sessions WHERE expires_at < now()`),
  manual ou automática, sem depender de agendador que expire por inatividade.
- Registrar a decisão em `DECISIONS.md`.

---

## DOC-001 — Atualizar o README da API

Status: aberta
Responsável: —

Objetivo:

O `README.md` está desatualizado em pontos conhecidos: descreve mídia e leads como "módulos vazios", diz que
as migrations criam apenas `agents` e `properties` (são 5), afirma que nenhum cliente R2 foi implementado e
não lista `ALLOWED_ORIGINS` na tabela de variáveis. Os comandos estão em PowerShell, mas o ambiente atual é Linux.

Critérios de conclusão:

- README refletindo o código atual, com os comandos em bash.
- Estado da entrega alinhado ao `PROJECT_STATUS.md`.

---

## Concluídas

### INFRA-001 — Criar e homologar Neon e Cloudflare R2 — concluída em 11/09/2026 (Claude)

Neon com PostgreSQL 16.15 em São Paulo, banco `corretor-db` e as 5 migrations aplicadas; bucket R2 `corretor-midia`
com URL pública e token restrito; primeiro ADMIN criado; dois backups em `backups/`; teste ponta a ponta com
Neon e R2 reais aprovado em 25 passos. Detalhes em `docs/handoffs/2026-09-11-infra-neon-r2.md`.
