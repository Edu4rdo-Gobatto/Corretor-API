# Estado atual — corretor-api

Atualizado em: 2026-09-11
Agente responsável: Claude (sessão de infraestrutura e homologação)
Commit da `main`: `a41f49b` — "crente - task: secure frontend API integration"
Repositório irmão: corretor-web, `main` em `d4f6b2f` ("feat: add complete SEO and SSR delivery")

## Em andamento

- Nada em execução por agente neste momento.
- Pesquisa de deploy (Render e Vercel) iniciada pelo Claude; resultado ainda não incorporado às tarefas.

## Concluído recentemente

- **Infraestrutura externa criada e homologada (11/09/2026).**
  - Neon: projeto com banco `corretor-db`, PostgreSQL 16.15, região `aws-sa-east-1` (São Paulo), conexão direta (sem pooler).
  - As 5 migrations foram aplicadas: `agents`, `properties`, `property_media`, `leads`, `refresh_sessions`.
  - Cloudflare R2: bucket `corretor-midia`, URL pública de desenvolvimento ativa e token com permissão Object Read & Write restrita ao bucket.
  - Primeiro ADMIN criado pelo `npm run bootstrap:admin`: id `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f`. As variáveis `BOOTSTRAP_*` foram removidas do `.env`.
  - Dois backups em `backups/` (após as migrations e após a homologação).
- **Teste ponta a ponta com Neon e R2 reais: 25 passos, todos aprovados.** Cobriu login com cookie de refresh,
  recusa de origem não autorizada (403), CRUD de imóvel, upload de 3 imagens ao R2, leitura pública, capa,
  exclusão com remoção no R2, detalhe público, página SSR do front com JSON-LD e `og:image`, lead recusado sem
  consentimento (400) e aceito com consentimento (201), e limpeza completa dos dados de teste.
- **Verificação local:** 13 suítes e 130 testes aprovados; lint, typecheck e build sem erro.

## Bloqueios

- **O commit `accd5d9` ("segurança e operações") não existe no GitHub nem nesta máquina.** Foi procurado em `main`,
  `shura`, commits soltos, stash, reflog, tags, forks e PRs. Ele contém, segundo o parecer da sessão anterior:
  Helmet, health check, rate limit de leads, criptografia AES-256-GCM dos dados pessoais de leads, filtro global
  de exceções, compatibilidade com o prefixo `/api/v1` e transações nas operações de mídia. Nada disso está no
  código publicado. Só o autor (SHURIKA6) pode recuperá-lo com um push.
- Sem esse commit, a API não tem rota de health nem filtro global de exceções, o que afeta o deploy no Render.
- O WhatsApp do administrador criado ficou com o número de exemplo `5565999999999` e precisa ser corrigido no painel.

## Próximo passo

Decidir o caminho de publicação da API (Render free ou alternativa), considerando cold start, ausência de rota de
health e a latência entre a API nos EUA e o Neon em São Paulo. Detalhes e tarefas em `TASKS.md`.

## Arquivos modificados recentemente

Nenhum arquivo de código foi alterado nesta sessão. Foram criados apenas os arquivos de contexto
(`AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `DECISIONS.md`, `TASKS.md`, `CHANGELOG_AI.md`, `docs/handoffs/`).

## Estado dos serviços externos

| Serviço | Estado | Detalhe |
|---|---|---|
| Neon | ativo | 1 admin, nenhum imóvel, mídia ou lead. Suspende após 5 min de inatividade; free tier de 0,5 GB por projeto |
| Cloudflare R2 | ativo | bucket vazio, fora uma imagem de amostra em `_amostra/` criada para teste manual |
| Render | não criado | — |
| Vercel | não criado | — |
