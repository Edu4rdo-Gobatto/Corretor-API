# Tarefas — corretor-api

Status possíveis: `aberta`, `em andamento`, `em revisão`, `bloqueada`, `concluída`.
Quem assume uma tarefa escreve o próprio nome em Responsável e reflete isso no `PROJECT_STATUS.md`.
Tarefas do front ficam em [../../Corretor-web/docs/TASKS.md](../../Corretor-web/docs/TASKS.md).

---

## 1. Pendências operacionais

> Tarefas que exigem criar conta ou validar dados para o `.env` têm arquivo próprio, com o passo a passo:
> [R2-URL-001](2026-10-14-tarefa-r2-url-publica.md) (alta), [NOTIFY-001](2026-10-14-tarefa-resend-aviso-contato.md),
> [DRIVE-001](2026-10-14-tarefa-google-drive.md), [LOGS-001](2026-10-14-tarefa-monitoramento-erros.md) e
> [ADMIN-001](2026-10-14-tarefa-dados-admin.md).

### DEPLOY-001 — Publicar a versão atual no ambiente de teste
- **Status:** aberta
- **Responsável:** a definir
- **Contexto:** o serviço Render `Corretor-API` existe. O último deploy registrado é de 08/10, no commit `86ecf29`.
  Os commits de 09/10 e 14/10 (`6b987a5`, `6305355`, `3358ebd`) não foram publicados, e o front depende deles.
- **Critérios de conclusão:**
  - Publicar a `main` atual no Render com autorização do dono, antes do front.
  - Conferir que o health check do Render aponta para `/api/v1/saude` e responde 200.
  - Conferir `ALLOWED_ORIGINS` com o domínio do front.
  - Validar pelo front: catálogo com vários tipos e seletor de pessoas da comissão.
  - Registrar o commit implantado e a data no `PROJECT_STATUS.md`.

### MIGRATION-20261009 — Aplicar comissão versionada e cadastros de contrato
- **Status:** fechada em 16/10 (Claude). O registro de 09/10 ("migration aplicada no Neon") estava incorreto: o banco
  estava nas 10 migrations de 17/09. Em 16/10 o backup completo foi gerado e as três pendentes
  (`1789689600000`, `1789776000000`, `1789862400000`) foram aplicadas; `migration:show` sem pendências. Falta
  publicar a API e cadastrar tipos e índices.
- **Responsável:** a definir
- **Contexto:** backup `backups/backup_20261016_1926.sql` (pg_dump 17, `DATABASE_URL_UNPOOLED`, fora do Git).
  Detalhes em [2026-10-09-comissao-versionada-cadastros-contrato.md](2026-10-09-comissao-versionada-cadastros-contrato.md)
  e no `CHANGELOG_AI.md`.
- **Critérios de conclusão:**
  - Backup completo do Neon verificado e `MIGRACAO_BACKUP_ARQUIVO` apontando para ele.
  - `npm run migration:run` aplica as pendentes; `migration:show` sem pendências.
  - API publicada antes do front; ADMIN cadastra tipos de contrato e índices de reajuste antes de criar contratos.

### TEST-API — `npm test` falha sem suítes
- **Status:** aberta
- **Responsável:** a definir
- **Contexto:** as suítes foram removidas em 03/10 (`ab59472`). O `jest.config.cjs` não tem `passWithNoTests`, então
  `npm test` sai com "No tests found" e código 1. Restam os scripts `test` e `test:watch`, as dependências do Jest,
  o `jest.config.cjs`, o `src/testing/schedule.mock.ts` e a variável `TESTE_LOCAL_DATABASE_URL` no `.env.example`.
- **Critérios de conclusão:**
  - O dono decide entre remover o Jest (scripts, dependências, configuração, mock e variável) ou configurá-lo
    com `passWithNoTests`.
  - A decisão fica registrada no `DECISIONS.md`.
  - `npm test`, se continuar existindo, sai com 0.

### FOTO-PERFIL-20261006 — Homologar a foto do perfil
- **Status:** concluída no código (`86ecf29`); homologação parcial
- **Responsável:** a definir
- **Contexto:** em 08/10, depois do deploy do `86ecf29`, `GET /api/corretores/1/foto` pela Vercel respondeu 302 e
  a imagem final 200 (registro no Corretor-web). Isso cobre só a leitura de uma foto com URL externa.
- **Pendente:**
  - Homologar o ciclo completo com login, upload, banco real, proxy e atualização da sessão.
  - Definir monitoramento ou limpeza de objetos órfãos no R2 (as falhas de exclusão só vão ao log).
  - Testar em Safari, iOS e celular físico.

### AUDIT-001 — Homologar os itens da auditoria full stack
- **Status:** aberta para homologação em ambiente real
- **Responsável:** a definir
- **Objetivo:** validar no ambiente de teste as correções feitas localmente em 02 e 03/10.
- **Critérios de conclusão:**
  - A09/A10 com PostgreSQL real: características inativas na ficha e busca telefônica com +55.
  - A11 em ambiente implantado: cold start da API e tempo de resposta do SSR.
  - Upload e leitura de mídias no R2 publicado.
  - Pastas de contrato no Google Drive com credenciais reais (desde 16/10, Meu Drive por OAuth; ver DRIVE-001).
- **Referência:** [auditoria full stack](../../Corretor-web/docs/2026-10-02-auditoria-fullstack.md).

### NOTIFY-001 — Avisar o corretor de novo contato
- **Status:** concluída no código (14/10, e-mail via Resend); falta criar a conta, verificar o domínio e configurar
  `RESEND_API_KEY` e `AVISO_EMAIL_REMETENTE` no Render, e homologar um envio real
- **Responsável:** a definir
- **Objetivo:** alertar o corretor responsável quando um visitante enviar contato pelo site (`POST /pessoas`).
- **Decidido (14/10):** canal e-mail, via Resend. Envio integrado ao registro do contato.
- **Critérios de conclusão (restantes):** conta Resend, domínio verificado, `RESEND_API_KEY` e
  `AVISO_EMAIL_REMETENTE` no Render e um envio real homologado. Passo a passo em
  [2026-10-14-tarefa-resend-aviso-contato.md](2026-10-14-tarefa-resend-aviso-contato.md).

### RENTAL-004 — Regras pendentes de contratos e comissões
- **Status:** encerramento antecipado e renovação concluídos no código (14/10); migration
  `1789776000000` aplicada no Neon em 16/10 com backup; falta deploy da API; validação contábil das
  parcelas segue aberta (contador)
- **Responsável:** a definir
- **O que o código já decide:**
  - O corretor comum cria contratos em que ele é o intermediador e não pode trocar o intermediador.
  - O corretor comum cria e vê comissões com imóvel e pessoa sob a responsabilidade dele.
  - Comissão é receita da imobiliária, de venda ou de locação, com valor informado e até 600 parcelas.
- **Feito (14/10):** `POST /admin/contratos/:id/encerrar` (data de encerramento e motivo; guarda o fim contratado) e
  `POST /admin/contratos/:id/renovar` (contrato novo ligado ao anterior; uma renovação por contrato). Parcelas e
  comissões não mudam sozinhas. DTOs conferidos em 14/10 com `ValidationPipe` (whitelist, int4, datas).
- **Falta:**
  - Deploy da API antes do front (migração já aplicada em 16/10).
  - Validação contábil do cálculo e da baixa manual das parcelas (contador).

### ADMIN-001 — Dados reais do administrador
- **Status:** aberta
- **Responsável:** a definir
- **Contexto:** a marca do front já usa o WhatsApp real. Em 17/09 o administrador do banco foi recriado com CPF de
  exemplo, e as `BOOTSTRAP_ADMIN_*` ficaram no `.env`. Não há registro posterior.
- **Critérios de conclusão:**
  - Conferir no painel o WhatsApp e o CPF do administrador e trocar o que for de exemplo.
  - Remover as `BOOTSTRAP_ADMIN_*` do `.env`.

### LIMPEZA-API — Restos sem uso
- **Status:** concluída (14/10): `lib-storage` removido, uploads paralelos (4), `hardening.ts` mantido como histórico
- **Prioridade:** baixa
- **Itens (todos resolvidos em 14/10):**
  - `@aws-sdk/lib-storage` removido do `package.json`.
  - Uploads de mídia ao R2 em paralelo, no máximo 4 (DB-04/PERF-02).
  - `1789084805000-hardening.ts` mantido como histórico, fora do registro.

---

## 2. Backlog

### PERF-001 — Cache e resiliência do banco
- **Prioridade:** média
- Avaliar cache ou pooling se o cold start do Neon pesar no ambiente publicado.
- Monitorar conexões simultâneas.

### LOGS-001 — Logs estruturados e telemetria
- **Prioridade:** média
- **Feito (14/10):** JSON em produção. **Falta:** monitoramento de exceções (Sentry/Logtail), que exige conta.
- Falta o monitoramento de exceções (por exemplo Sentry ou Logtail). Ver [2026-10-14-tarefa-monitoramento-erros.md](2026-10-14-tarefa-monitoramento-erros.md).

### RELATORIO-001 — Relatórios financeiros consolidados
- **Prioridade:** média
- Endpoints de agregação mensal de comissões pendentes e recebidas, para exportação pelo ADMIN.

### SEC-002 — Limites de taxa fora da memória
- **Prioridade:** baixa enquanto houver uma só instância
- **Feito (14/10):** o teto de 10.000 chaves não bloqueia mais todos os logins (descarta a mais antiga).
- Os limites de login e de contatos vivem na memória do processo. Com mais de uma instância, exigem armazenamento
  compartilhado.

---

## 3. Concluídas recentemente

- **CIDADES-20261016** (16/10): cadastro de cidades, rotas pública e admin, validação no imóvel. Migration `1789862400000` aplicada (backup `backups/backup_20261016_1926.sql`); falta deploy.
- **EXIBIR-SITE-20261016** (16/10): visibilidade pública e contato só por `ativo`; testes de `ImoveisService` e `PessoasService`. Migration `1789776000000` aplicada; falta deploy da API e front.
- **SEIS-PONTOS-20261009** (09/10, `6b987a5`): CRECI, `tipo_id` em lista e pessoas elegíveis. Migration `1789689600000` aplicada; falta deploy da API.
- **OPS-001** (02/10 e 06/10): limpeza de sessões expiradas no boot e a cada hora, por `setInterval` no `SessoesService`.
