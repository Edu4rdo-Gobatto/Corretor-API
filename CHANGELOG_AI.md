# Histórico de trabalho dos agentes — corretor-api

Registro objetivo, do mais recente para o mais antigo. Cada entrada traz tarefa, alterações,
testes com resultado real e pendências.

## 2026-09-12 — Claude (ambiente de desenvolvimento e limpeza de dados fixos)

Tarefa: subir a API em desenvolvimento, testar, e limpar os dados fixos a pedido do dono do projeto.

Alterações em código da API: nenhuma. Alterados apenas os arquivos de contexto
(`PROJECT_STATUS.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG_AI.md`).

Ações fora do repositório:

- Backup do banco antes de qualquer escrita: `backups/backup_20260912_0908.sql` (`pg_dump` 16 via Docker).
- `DELETE` das 2 linhas de `refresh_sessions` deixadas pelos logins de homologação de 11/09. Tabela agora vazia.
- Objeto `_amostra/teste-navegador.png` removido do bucket R2 `corretor-midia`, que ficou vazio.
- Trabalho no repositório irmão corretor-web: remoção completa do modo demonstração e centralização da identidade
  em `src/config/brand.ts`. Registrado no `CHANGELOG_AI.md` de lá.

Testes executados:

- `npm test`: 13 suítes, 130 testes aprovados.
- `npm run lint` e `npm run typecheck`: sem erro.
- `npm run start:dev`: a API subiu, conectou ao Neon (TypeORM em ~2 s) e mapeou as 20 rotas.
- Verificação HTTP com a API no ar: `GET /properties` 200 com página vazia; `GET /properties?page=1&limit=5` 200
  respeitando o `limit`; `GET /auth/me` e `GET /agents` 401 sem token; `GET /` 404.
- `POST /auth/login` com as credenciais do `.env`: **401**. Ver Achados.
- Integração com o front: `GET /api/properties` pelo proxy do SSR respondeu 200 com o mesmo corpo da API.

Achados:

- **O login do administrador está quebrado.** O e-mail de `BOOTSTRAP_ADMIN_EMAIL` confere com o do banco, mas a senha
  não: `POST /auth/login` responde 401. O hash Argon2id gravado em 11/09 não corresponde ao valor atual de
  `BOOTSTRAP_ADMIN_PASSWORD`. Como o hash é de mão única, a senha original não é recuperável. Aberta a tarefa
  ADMIN-002 para redefinir. **Sem isso, o painel não abre** — só o catálogo público funciona.
- **As quatro variáveis `BOOTSTRAP_*` voltaram ao `.env`**, com a senha em texto claro, contrariando a decisão de
  11/09 — e a senha ali nem é válida. O `.env.example` versionado também foi sobrescrito com essa estrutura e perdeu
  os comentários que documentavam cada campo; aparece como modificado e não commitado no Git. Não foi alterado nesta
  sessão porque o dono não incluiu esse item no escopo da limpeza que pediu.
- O WhatsApp do administrador no banco continua `5565999999999`, o número de exemplo (ADMIN-001). A correção depende
  do acesso ao painel e do número real.
- O código da API não tem dado fixo de produto: os telefones e e-mails de exemplo estão só em `*.spec.ts` e em
  `src/testing/`, que é onde devem ficar. O nome do bucket `corretor-midia` é fixo em `src/media/media.service.ts`
  por decisão de 11/09, e o fallback `http://localhost:5173` de `ALLOWED_ORIGINS` só vale em desenvolvimento.
- O driver `pg` emite aviso de que `sslmode=require` passará a ter semântica libpq em versão futura. Não afeta a
  aplicação hoje (a validação de ambiente já exige TLS verificado), mas vale acompanhar na atualização do `pg`.

Pendências:

- ADMIN-002: redefinir a senha do administrador. Aguardando a senha escolhida pelo dono.
- ADMIN-001: WhatsApp real do administrador.
- Limpar as `BOOTSTRAP_*` do `.env` e restaurar o `.env.example` com os comentários — fora do escopo pedido, mas
  recomendado; está registrado em `DECISIONS.md`.
- OPS-001: a limpeza de sessões continua manual; a rotina ainda não existe.
- SEC-001 e DEPLOY-001 seguem como estavam.

Sem cobertura de teste: a redefinição de senha (ainda não implementada) e o fluxo autenticado ponta a ponta com o
banco real, que não pôde ser reexecutado por causa do login bloqueado.

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
