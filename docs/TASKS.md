# Tarefas — corretor-api

## SEIS-PONTOS-20261009 — CRECI, catálogo por tipos e clientes da comissão (API)

- **Responsável:** Claude.
- **Status:** concluída localmente; publicação depende de autorização.
- [x] CRECI `^\d+[JF]?$` no DTO-base: maiúsculo, vazio → null, PATCH sem campo preserva, legado lido intacto.
- [x] `tipo_id` com um id ou CSV de até 20, sem duplicados, `IN` parametrizado, 400 para inválidos; público e admin.
- [x] `GET /admin/comissoes/pessoas-elegiveis` antes de `:id`, filtrado antes da paginação, permissões atuais.
- [x] Typecheck, lint, build e QA efêmero com ValidationPipe real e PostgreSQL descartável (78/78).
- [ ] Publicar a API (antes do frontend) quando o dono autorizar.

## FOTO-PERFIL-20261006 — Upload e leitura controlada

- **Responsável:** Codex.
- **Status:** concluída localmente; homologação real do perfil separada.
- [x] PATCH JSON/multipart exclusivo, sessão/origem, quantidade/tamanho/assinatura.
- [x] Storage/quota compartilhados, Put antes de transação e compensação/limpeza por proprietário.
- [x] GET público por corretor ativo, R2 privado ou redirect HTTPS; sem chave arbitrária.
- [x] Preservar Corretor/url_foto/schema e trabalho anterior; proteger contra referência obsoleta.
- [x] Tipos, lint, build, HTTP efêmero, R2 temporário real e documentação.
- [ ] Homologar um perfil real com login, upload, banco, proxy e atualização da sessão.
- [ ] Definir monitoramento/limpeza operacional de objetos órfãos e publicar somente se autorizado.

Status possíveis: `aberta`, `em andamento`, `em revisão`, `bloqueada`, `concluída`.
Quem assume uma tarefa escreve o próprio nome em Responsável e reflete isso no `docs/PROJECT_STATUS.md`.
Tarefas do front ficam em `../Corretor-web/docs/TASKS.md`.

---

## 1. Pendências Operacionais e Lançamento (Produção)

### DEPLOY-001 — Publicar a API em produção (Render/VPS)
- **Status:** aberta
- **Responsável:** a definir
- **Objetivo:** Subir o backend no serviço de hospedagem definitiva (Render/VPS) apontando para o Neon e Cloudflare R2 reais.
- **Critérios de conclusão:**
  - Ambiente Node 24 com `npm run start:prod`.
  - Configurar variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`, credenciais do R2, etc.).
  - Configurar `ALLOWED_ORIGINS` com o domínio real do front-end.
  - Health check da API respondendo 200 em `/api/v1/saude`.

### AUDIT-001 / AUDIT-REV — Homologação dos itens da Auditoria Full Stack
- **Status:** aberta para homologação em ambiente real
- **Responsável:** a definir
- **Objetivo:** Validar em produção as correções de integridade e segurança realizadas localmente.
- **Critérios de conclusão:**
  - Testar banco PostgreSQL Neon com as migrations aplicadas e integridade referencial.
  - Validar upload e leitura de mídias no Cloudflare R2 em produção.
  - Validar integração com Google Drive para criação automática das pastas privadas de contratos.
  - Validar comportamento e tempo de resposta em caso de cold start da API.

### NOTIFY-001 — Avisar o corretor de novo contato
- **Status:** aberta (aguardando definição de canal com o dono)
- **Responsável:** a definir
- **Objetivo:** Alertar imediatamente o corretor responsável quando um visitante enviar uma proposta ou mensagem de contato no site (`POST /pessoas`).
- **Critérios de conclusão:**
  - Escolher canal de envio (WhatsApp via API externa ou E-mail transacional via Resend/SendGrid).
  - Integrar envio no momento do registro do contato.

### RENTAL-004 — Definição de regras e permissões de contratos e comissões
- **Status:** aberta (aguardando alinhamento de produto com o dono)
- **Responsável:** a definir
- **Objetivo:** Consolidar regras de negócio para a gestão de contratos e intermediações.
- **Critérios de conclusão:**
  - Definir fluxo exato para encerramento ou renovação de contratos de locação.
  - Definir se corretores comuns podem criar ou apenas visualizar contratos e comissões atribuídos a eles.
  - Validar o cálculo e baixa manual de parcelas de comissão de captação.

### ADMIN-001 — Configurar o WhatsApp comercial definitivo
- **Status:** aberta (aguardando número real)
- **Responsável:** a definir
- **Objetivo:** Substituir o número provisório de exemplo (`5565999999999`) pelo telefone real de atendimento do corretor Lucas Gobatto.
- **Critérios de conclusão:**
  - Atualizar o cadastro do administrador no painel ou via API.
  - Validar se o botão de WhatsApp utiliza o telefone real.

---

## 2. Sugestões de Melhorias e Backlog Futuro

### PERF-001 — Caches e resiliência de banco (Neon)
- **Prioridade:** Média (P2)
- **Sugestão:**
  - Implementar estratégias de cache ou connection pooling caso a latência de cold start do Neon gere gargalos em produção.
  - Monitorar consumo de conexões simultâneas na camada de persistência.

### LOGS-001 — Sistema centralizado de logs e telemetria
- **Prioridade:** Média (P2)
- **Sugestão:**
  - Substituir logs pontuais por logger estruturado (Pino ou Nest Logger com formatação JSON) para rastreabilidade de erros em produção.
  - Integrar monitoramento de exceções (ex: Sentry ou Logtail).

### RELATORIO-001 — Relatórios financeiros consolidados
- **Prioridade:** Média (P2)
- **Sugestão:**
  - Endpoints de agregação mensal de receitas de locação e comissões pendentes/recebidas para exportação pelo administrador.

### OPS-001 — Job de limpeza periódica de sessões expiradas
- **Prioridade:** Baixa (P3)
- **Sugestão:**
  - Rotina agendada (Cron) para expurgo periódico de linhas de `sessao_login` antigas/expiradas.
