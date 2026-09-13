# Estado atual — corretor-api

Atualizado em: 2026-09-12
Agente responsável: Claude (sessão de ambiente de desenvolvimento e limpeza de dados fixos)
Commit da `main`: `a41f49b` — "crente - task: secure frontend API integration"
Repositório irmão: corretor-web, `main` em `d4f6b2f` ("feat: add complete SEO and SSR delivery")

## Em andamento

- **ADMIN-002 — acesso ao painel bloqueado.** A senha do único administrador não confere com o hash do banco;
  aguardando o dono escolher a senha nova para a redefinição.
- Ambiente de desenvolvimento no ar: API em `http://localhost:3000` (conectada ao Neon) e front SSR em
  `http://127.0.0.1:5173`, com o proxy `/api` funcionando.
- Pesquisa de deploy (Render e Vercel) iniciada pelo Claude; resultado ainda não incorporado às tarefas.

## Concluído recentemente

- **Ambiente de desenvolvimento levantado e verificado (12/09/2026).** `npm test` com 13 suítes e 130 testes
  aprovados, lint, typecheck e build sem erro. A API subiu, conectou ao Neon e respondeu: `GET /properties` 200,
  `GET /auth/me` e `GET /agents` 401 sem token, rota inexistente 404. O front subiu e o proxy `/api/properties`
  respondeu 200 através dele.
- **Dados de teste da homologação removidos (12/09/2026).** Backup `backups/backup_20260912_0908.sql` gerado antes.
  Apagadas as 2 linhas de `refresh_sessions` dos logins de 11/09 e o objeto `_amostra/teste-navegador.png` do bucket
  R2, que agora está vazio. O banco segue com 1 administrador e nenhum imóvel, mídia ou lead.
- **Limpeza de dados fixos no repositório irmão (12/09/2026).** O modo demonstração foi removido por inteiro do
  corretor-web e a identidade do site foi centralizada em `src/config/brand.ts`. Detalhes no `CHANGELOG_AI.md` de lá.

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
  Depende de ADMIN-002 (sem acesso ao painel) e do número real, que só o dono tem.
- **A senha do administrador não confere com o hash do banco.** `POST /auth/login` responde 401 com o valor que está
  em `BOOTSTRAP_ADMIN_PASSWORD`. Sem redefinir, não há acesso ao painel — só o catálogo público funciona. Ver ADMIN-002.
- **As variáveis `BOOTSTRAP_*` voltaram ao `.env`** e o `.env.example` versionado foi sobrescrito, perdendo os
  comentários. Contraria a decisão de 11/09; o `.env.example` aparece como modificado e não commitado no Git.

## Próximo passo

Destravar ADMIN-002 (redefinir a senha do administrador) para poder testar o painel ponta a ponta. Em seguida,
corrigir o WhatsApp (ADMIN-001) e retomar a decisão de publicação da API, considerando cold start, ausência de rota
de health e a latência entre a API nos EUA e o Neon em São Paulo. Detalhes e tarefas em `TASKS.md`.

## Arquivos modificados recentemente

Nenhum arquivo de código da API foi alterado nesta sessão. Alterados apenas os arquivos de contexto
(`PROJECT_STATUS.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG_AI.md`). O `.env.example` aparece modificado no Git
desde antes desta sessão, por alteração de terceiro — ver Bloqueios.

## Estado dos serviços externos

| Serviço | Estado | Detalhe |
|---|---|---|
| Neon | ativo | 1 admin, nenhum imóvel, mídia, lead ou sessão. Suspende após 5 min de inatividade; free tier de 0,5 GB por projeto |
| Cloudflare R2 | ativo | bucket **vazio**: a imagem de amostra em `_amostra/` foi apagada em 12/09 |
| Render | não criado | — |
| Vercel | não criado | — |

## 2026-09-12 — Codex: administração de locações em implementação

Área assumida: cadastros, contratos e documentos privados (ADMIN). Comissão de captação parcelada iniciada em `src/finance/`, sem SI9/Imonov. Alterações preexistentes preservadas; sem commit/push e sem mudança automática do banco real.


## 2026-09-13 — Codex: URLs em português
Área assumida: rotas do front, compatibilidade e SEO; implementação do plano aprovado em andamento. API sem mudanças de contrato.


## 2026-09-13 — Codex: URLs em português concluídas
Rotas públicas: /imoveis/{tipo}, /imoveis/para-alugar, /imoveis/para-comprar e combinações; query cidade/preco-minimo/preco-maximo/pagina. Painel: /admin/entrar e /admin/contatos. URLs antigas redirecionam 301; navegador usa replace; slugs e APIs preservados.
Publicação Vercel dpl_Bbf5617bGJdqKv79WJbuDDFJaP1M READY, alias https://corretor-web-test.vercel.app. SITE_URL e SEO_INDEXABLE configuradas em Production conforme autorização. Robots, llms e sitemap respondem 200; raiz index,follow; filtros noindex,follow; painel noindex,nofollow. Sitemap contém início e privacidade (catálogo público sem imóveis no momento).
Validação: typecheck, lint, build, suíte de 93 testes e teste adicional de navegação aprovado (94 no total coberto); smoke SSR/proxy/discovery aprovado. Navegador: redirecionamento, paginação e detalhe com fixture local; catálogo filtrado publicado confirmado. Login autenticado/logout e fichas reais não exercitados no navegador nesta sessão; permissões existentes cobertas pela suíte. Sem commit/push.


## 2026-09-13 — Preparação de commit e push autorizada
Codex: revisão do diff concluída; typecheck, lint, 21 arquivos/94 testes, build e smoke de SEO aprovados novamente. Front: código e documentação das URLs; API: somente documentação correspondente. Alterações anteriores da API em .env.example e .gitignore excluídas do commit.
