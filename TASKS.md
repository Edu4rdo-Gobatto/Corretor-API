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

Status: bloqueada por ADMIN-002 (e pelo número real, que o dono precisa informar)
Responsável: —

Objetivo:

O ADMIN `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f` foi criado com o número de exemplo `5565999999999`,
que aparece no botão de WhatsApp dos imóveis.

Critérios de conclusão:

- Número real gravado, via painel em `/admin/corretores` ou `PATCH /agents/:id` com token de ADMIN.
- Conferir na página pública de um imóvel que o link `wa.me` usa o número correto.

---

## ADMIN-002 — Acesso ao painel bloqueado: senha do administrador não confere

Status: em andamento
Responsável: Claude (aguardando a senha escolhida pelo dono)

Objetivo:

O único administrador (`190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f`) não consegue entrar no painel. O e-mail do `.env`
confere com o do banco, mas a senha não: `POST /auth/login` responde 401. O hash Argon2id gravado em 11/09 não
corresponde ao valor que está hoje em `BOOTSTRAP_ADMIN_PASSWORD`. Como o hash é de mão única, só resta redefinir.

Critérios de conclusão:

- Comando de redefinição de senha criado, validando a senha com as mesmas regras do cadastro (12 a 128 caracteres)
  e reusando o `PasswordService` já existente. Registrar em `DECISIONS.md`.
- Backup do banco antes da escrita (feito: `backups/backup_20260912_0908.sql`).
- `POST /auth/login` respondendo 200 com cookie de refresh, e `/admin` abrindo no front.
- Variáveis `BOOTSTRAP_*` removidas do `.env` depois, e `.env.example` restaurado com os comentários originais.

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

Em 12/09 as 2 linhas de teste foram apagadas à mão e ficou registrado em `DECISIONS.md` que a limpeza segue manual
até a publicação da API. A tabela está vazia hoje, mas a tarefa continua aberta: falta a rotina.

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

## RENTAL-001 — Cadastros, contratos e documentos privados — em revisão

Responsável: Codex. Escopo e interfaces: docs/plans/2026-09-12-rental-administration.md.

Critérios: ADMIN em todas as rotas; fichas PF/PJ e dados bancários; contrato com vínculos válidos; documentos privados com tamanho/assinatura validados; busca/paginação; nenhuma comissão presumida. Validação local e revisão em andamento, resultados finais no CHANGELOG_AI.md.

## RENTAL-002 — Homologar banco e documentos privados — bloqueada por ambiente

Disponibilizar o .env local pelo fluxo habitual do dono, sem enviá-lo ao chat. Verificar acesso ADMIN, fazer backup do Neon, conferir migrations já aplicadas e executar a nova migration explicitamente. Provisionar bucket privado R2 e acesso do token; configurar R2_DOCUMENTS_BUCKET. Verificar cadastro/edição de pessoa, criação/encerramento de contrato, upload/download/exclusão reais e recusa de download anônimo. Confirmar no painel R2 ausência de acesso público. Nenhum dado real foi alterado nesta sessão.

## RENTAL-003 — Comissão de captação parcelada — em implementação

Regra provisória informada pelo dono: comissão de captação equivalente a um aluguel, parcelamento configurável e confirmação manual ADMIN. A implementação inicial está em `src/finance/`; pagamentos de aluguel e repasses mensais permanecem na sequência. SI9/Imonov, importação e alertas seguem fora do escopo.


## URL-001 — Padronizar URLs — concluída
Responsável: Codex. Implementação e publicação no front, contratos da API preservados. Validação e limites registrados em PROJECT_STATUS.md e CHANGELOG_AI.md.
