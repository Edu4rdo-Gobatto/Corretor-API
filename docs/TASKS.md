# Tarefas — corretor-api

Status possíveis: `aberta`, `em andamento`, `em revisão`, `bloqueada`, `concluída`.
Quem assume uma tarefa escreve o próprio nome em Responsável e reflete isso no `PROJECT_STATUS.md`.
Tarefas do front ficam em [../../Corretor-web/docs/TASKS.md](../../Corretor-web/docs/TASKS.md).

---

## 1. Pendências operacionais

### DEPLOY-001 — Publicar a versão atual no ambiente de teste
- **Status:** aberta
- **Responsável:** a definir
- **Contexto:** o serviço Render `Corretor-API` existe. O último deploy registrado é de 08/10, no commit `86ecf29`.
  O commit `6b987a5` (09/10) não foi publicado, e o front de 09/10 depende dele.
- **Critérios de conclusão:**
  - Publicar a `main` atual no Render com autorização do dono, antes do front.
  - Conferir que o health check do Render aponta para `/api/v1/saude` e responde 200.
  - Conferir `ALLOWED_ORIGINS` com o domínio do front.
  - Validar pelo front: catálogo com vários tipos e seletor de pessoas da comissão.
  - Registrar o commit implantado e a data no `PROJECT_STATUS.md`.

### MIGRATION-20261009 — Aplicar comissão versionada e cadastros de contrato
- **Status:** migration aplicada no Neon em 09/10 (Claude), sem backup por decisão do dono; falta publicar a API
  `6305355` e cadastrar tipos e índices
- **Responsável:** a definir
- **Contexto:** a migration `1789689600000-comissao-versionada-cadastros-contrato` e o código correspondente estão
  só no checkout local, sem commit. Validação feita em PostgreSQL descartável. Detalhes em
  [2026-10-09-comissao-versionada-cadastros-contrato.md](2026-10-09-comissao-versionada-cadastros-contrato.md).
- **Critérios de conclusão:**
  - Commit autorizado pelo dono.
  - Backup completo do Neon verificado e `MIGRACAO_BACKUP_ARQUIVO` apontando para ele.
  - `npm run migration:run` aplicado; `migration:show` sem pendências; revisões v1 criadas para todas as comissões.
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
  - Pastas de contrato no Google Drive com credenciais reais.
- **Referência:** [auditoria full stack](../../Corretor-web/docs/2026-10-02-auditoria-fullstack.md).

### NOTIFY-001 — Avisar o corretor de novo contato
- **Status:** aberta (aguardando definição de canal com o dono)
- **Responsável:** a definir
- **Objetivo:** alertar o corretor responsável quando um visitante enviar contato pelo site (`POST /pessoas`).
- **Critérios de conclusão:**
  - Escolher o canal (WhatsApp por API externa ou e-mail transacional).
  - Integrar o envio no registro do contato.

### RENTAL-004 — Regras pendentes de contratos e comissões
- **Status:** aberta (aguardando o dono)
- **Responsável:** a definir
- **O que o código já decide:**
  - O corretor comum cria contratos em que ele é o intermediador e não pode trocar o intermediador.
  - O corretor comum cria e vê comissões com imóvel e pessoa sob a responsabilidade dele.
  - Comissão é receita da imobiliária, de venda ou de locação, com valor informado e até 600 parcelas.
- **Falta decidir:**
  - Fluxo de encerramento antecipado e de renovação de contratos (hoje o contrato só vira INATIVO pela data ou
    por alteração manual).
  - Validação contábil do cálculo e da baixa manual das parcelas.

### ADMIN-001 — Dados reais do administrador
- **Status:** aberta
- **Responsável:** a definir
- **Contexto:** a marca do front já usa o WhatsApp real. Em 17/09 o administrador do banco foi recriado com CPF de
  exemplo, e as `BOOTSTRAP_ADMIN_*` ficaram no `.env`. Não há registro posterior.
- **Critérios de conclusão:**
  - Conferir no painel o WhatsApp e o CPF do administrador e trocar o que for de exemplo.
  - Remover as `BOOTSTRAP_ADMIN_*` do `.env`.

### LIMPEZA-API — Restos sem uso
- **Status:** aberta
- **Prioridade:** baixa
- **Itens:**
  - `@aws-sdk/lib-storage` está no `package.json` e nenhum arquivo o importa.
  - Uploads de mídia vão ao R2 em sequência (achado DB-04/PERF-02 da auditoria de 11/09).
  - `1789084805000-hardening.ts` está no disco e fora do registro; decidir se fica como histórico.

---

## 2. Backlog

### PERF-001 — Cache e resiliência do banco
- **Prioridade:** média
- Avaliar cache ou pooling se o cold start do Neon pesar no ambiente publicado.
- Monitorar conexões simultâneas.

### LOGS-001 — Logs estruturados e telemetria
- **Prioridade:** média
- Logger estruturado em JSON para rastrear erros no ambiente publicado.
- Monitoramento de exceções (por exemplo Sentry ou Logtail).

### RELATORIO-001 — Relatórios financeiros consolidados
- **Prioridade:** média
- Endpoints de agregação mensal de comissões pendentes e recebidas, para exportação pelo ADMIN.

### SEC-002 — Limites de taxa fora da memória
- **Prioridade:** baixa enquanto houver uma só instância
- Os limites de login e de contatos vivem na memória do processo. Com mais de uma instância, exigem armazenamento
  compartilhado. O teto de 10.000 chaves do `TentativasGuard` pode bloquear todos os logins se for enchido.

---

## 3. Concluídas recentemente

- **SEIS-PONTOS-20261009** (09/10, `6b987a5`): CRECI, `tipo_id` em lista e pessoas elegíveis. Publicação em DEPLOY-001.
- **OPS-001** (02/10 e 06/10): limpeza de sessões expiradas no boot e a cada hora, por `setInterval` no `SessoesService`.
