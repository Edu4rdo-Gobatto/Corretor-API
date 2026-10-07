# Instruções do projeto — corretor-api

## 2026-10-06 — Contrato vigente da foto do perfil

Plano do dono autoriza refinamento no frontend/API, com entrega local sem commit/push/deploy/migrations.
Ler `2026-10-06-foto-perfil.md` e `INDICE.md`. PATCH /autenticacao/eu mantém JSON e aceita multipart
com um campo foto JPG/PNG/WebP <=10 MiB, exclusivo com url_foto explícita. Preservar autenticação,
OrigemGuard, validação e contrato Corretor. Storage e quota são compartilhados por ArmazenamentoModule,
sem dependência circular. Put antes da transação; novo objeto compensado se DB falhar; anterior gerenciado
do proprietário excluído somente após sucesso. Não apagar URLs externas/objetos de terceiros.
GET público /corretores/:id/foto consulta corretor ativo e sua referência atual; nenhuma chave arbitrária.
URL gerenciada obsoleta recebe 409. Não reenviar foto sem alteração no cliente. Bucket privado preservado.
Alterações anteriores staged/untracked do catálogo foram mantidas. QA novo é efêmero no frontend irmão;
sem recriar suítes. R2 temporário real aprovado; perfil real no Neon não homologado nesta entrega.

## Contexto

API REST do sistema de corretor de imóveis comerciais. NestJS 11 sobre Express, TypeScript estrito,
TypeORM 0.3 e PostgreSQL 16 hospedado no Neon. Mídia em Cloudflare R2 via `@aws-sdk/client-s3`.
Node `>=24 <25` e npm `>=11`.

Repositório irmão: **corretor-web** (React 18 + Vite 7 + SSR próprio), em `../Corretor-web`.
Os dois repositórios compartilham a especificação `corretor-spec.json` e o `docs/PLANO-PROJETO-CORRETOR.md`,
e cada um mantém a sua própria cópia dos arquivos de contexto descritos abaixo.

## Comandos

| Ação | Comando | Precisa de `.env`/rede |
|---|---|---|
| Instalar dependências | `npm ci` | não |
| Desenvolvimento (watch) | `npm run start:dev` | sim (Neon) |
| Build | `npm run build` | não |
| Executar o build | `npm run start:prod` | sim (Neon) |
| Testes | `npm test` | não |
| Testes em watch | `npm run test:watch` | não |
| Lint | `npm run lint` | não |
| Tipos | `npm run typecheck` | não |
| Ver migrations | `npm run migration:show` | sim |
| Aplicar migrations | `npm run migration:run` | sim |
| Reverter a última migration | `npm run migration:revert` | sim |
| Criar o primeiro ADMIN | `npm run bootstrap:admin` | sim |

`migration:*` e `bootstrap:admin` carregam o `.env` e validam **todas** as variáveis antes de conectar,
inclusive `JWT_SECRET` e as `R2_*`.

Backup do banco (não há cliente Postgres instalado; usa-se Docker):

```bash
export PGURL="$(node -e "require('dotenv').config({quiet:true}); process.stdout.write(process.env.DATABASE_URL)")"
docker run --rm -e PGURL postgres:16 sh -c 'pg_dump --no-owner --no-privileges "$PGURL"' > backups/backup_$(date +%Y%m%d_%H%M).sql
unset PGURL
```

## Regras

**Segredos e ambiente**
- Nunca comitar `.env`, dumps, tokens ou credenciais. `.env`, `*.sql` e `backups/` já estão no `.gitignore`.
- Não alterar variáveis de ambiente sem registrar em `docs/DECISIONS.md` e avisar no `docs/PROJECT_STATUS.md`.
- Não imprimir valores de segredo em log, teste ou mensagem. Erros de configuração citam só nomes de campos.
- O `.env` de desenvolvimento existe na máquina do dono do projeto e **não** é reconstruído por agentes.

**Banco de dados**
- Só Neon. `DATABASE_URL` exige host `*.neon.tech`, usuário, senha, banco e `sslmode=require|verify-ca|verify-full`,
  aceitando apenas os parâmetros `sslmode` e `channel_binding`. Não existe modo sem banco, e Postgres local é recusado na validação.
- **As 5 migrations já foram aplicadas no Neon em 11/09/2026.** Não edite, renomeie nem apague migration existente:
  crie uma nova. Alterar uma já aplicada quebra o histórico do banco real.
- `synchronize` e `migrationsRun` continuam `false`. O schema muda só por migration explícita.
- Faça backup antes de qualquer mudança estrutural e registre no `docs/CHANGELOG_AI.md`.
- O banco de produção contém o administrador real do sistema. Não apague dados sem autorização explícita.

**Mídia**
- O bucket R2 é `corretor-midia`, fixo no código. Uploads ficam em memória e vão direto ao R2;
  nada é gravado no disco do servidor, porque o filesystem do Render é efêmero.
- Ao excluir mídia, apague o objeto no R2 e a linha no banco. Excluir um imóvel remove as linhas por CASCADE,
  mas **não** apaga objetos no R2: apague a mídia antes.

**Código**
- Toda feature nova cabe em `entity + dto + service + controller` dentro de um módulo. Se não couber, discuta antes.
- Um padrão por problema: TypeORM como único ORM, `class-validator` + `class-transformer` como única validação.
  Não introduza Prisma, Drizzle, zod, Joi ou outro validador nesta API.
- O `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` e `transform`: todo campo novo precisa estar no DTO,
  senão a requisição responde 400.
- TypeScript estrito. Não use `any` nem `@ts-ignore` para contornar tipo.
- Não adicione dependência sem justificar em `docs/DECISIONS.md`.
- Respostas públicas nunca expõem e-mail, papel, hash de senha ou `storageKey`.

**Fluxo de trabalho**
- Este projeto trabalha **direto na `main`**, sem branches paralelas (decisão do dono em 11/09/2026, quando a
  branch `shura` foi apagada por já estar contida na `main`). Antes de commitar: rode os testes, confirme com o dono
  e nunca inclua segredo no commit.
- Rode `npm run typecheck`, `npm run lint` e `npm test` depois de qualquer mudança relevante, e registre o resultado.
- Código que compila não significa tarefa concluída: o critério está em `docs/TASKS.md`.
- Antes de implementar, leia `docs/PROJECT_STATUS.md`, `docs/TASKS.md`, `docs/DECISIONS.md`, o último registro de `docs/CHANGELOG_AI.md`
  e, para regras de produto, `corretor-spec.json`.

## Protocolo entre agentes

Antes de trabalhar:

1. Ler `docs/PROJECT_STATUS.md`, `docs/TASKS.md`, `docs/DECISIONS.md` e o último registro de `docs/CHANGELOG_AI.md`.
2. Verificar o estado do Git: `git status`, `git log --oneline -5` e se a branch está sincronizada com o remoto.
3. Conferir em `docs/PROJECT_STATUS.md` se outro agente já assumiu a mesma área. Se sim, escolher outra tarefa ou combinar a divisão.
4. Atualizar `docs/PROJECT_STATUS.md` com a tarefa assumida, o seu nome e a data.

Depois de trabalhar:

1. Atualizar `docs/PROJECT_STATUS.md` (em andamento, concluído, bloqueios, próximo passo, arquivos tocados).
2. Registrar decisões relevantes em `docs/DECISIONS.md`, com motivo e o que não fazer.
3. Registrar em `docs/CHANGELOG_AI.md` a tarefa, os arquivos alterados, os testes executados com o resultado real e as pendências.
4. Informar riscos e pendências de forma explícita, inclusive o que ficou sem teste.

Divisão sugerida de papéis:

| Etapa | Agente | Responsabilidade |
|---|---|---|
| Planejamento | Claude | Entender o problema, propor arquitetura e critérios de conclusão em `docs/TASKS.md` |
| Implementação | Codex | Alterar código, criar testes e executar os comandos |
| Revisão | Claude | Ler o diff, procurar bugs e falhas de segurança, registrar em `docs/CHANGELOG_AI.md` |
| Correções | Codex | Aplicar os ajustes da revisão |
| Validação final | Ambos | Conferir testes, build e estado do Git |

Não deixe os dois agentes editando a mesma área ao mesmo tempo.

## Mapa do código

```text
src/
  main.ts            # ValidationPipe global, CORS por ALLOWED_ORIGINS, trust proxy 1, listen 0.0.0.0:PORT
  app.module.ts      # ConfigModule validado, TypeORM assíncrono e os 5 módulos
  config/            # env.validation.ts (10 variáveis) e database.config.ts (TLS verificado)
  database/          # data-source.ts do CLI e 5 migrations aplicadas
  auth/              # login, refresh rotativo em cookie, logout, JwtStrategy, guards de papel/origem/rate limit
  agents/            # corretores: listagem, criação e edição (ADMIN), proteção do último ADMIN
  properties/        # catálogo público e gestão por dono; slug estável; filtros e paginação
  media/             # upload multipart para o R2, embeds YouTube/Vimeo, ordem, capa e exclusão
  leads/             # criação pública com consentimento LGPD, listagem por papel e exclusão
  common/security/   # hash Argon2id compartilhado
  testing/           # fixtures de repositório em memória usadas nos testes HTTP
```

Endpoints e regras detalhadas estão no `docs/README.md` e, com o estado atual, em `docs/PROJECT_STATUS.md`.

## Serviços externos

| Serviço | Situação | Observação |
|---|---|---|
| Neon (PostgreSQL 16) | ativo, com as migrations aplicadas | região fixa; conexão direta, sem pooler |
| Cloudflare R2 | ativo, bucket `corretor-midia` | URL `r2.dev` respondeu 401 em leitura pública; não habilitar o bucket sem decisão |
| Render (API) | não criado | próximo marco |
| Vercel (front) | não criado | próximo marco |

Credenciais ficam apenas no `.env` local e, quando houver deploy, no painel de cada serviço.

## 2026-09-14 — Instruções vigentes após refatoração integral

O pedido integral do dono em docs/2026-09-13-backend-integral.md prevalece sobre instruções antigas conflitantes deste arquivo. Contrato e operação atual: docs/2026-09-14-backend-portugues.md. Backend em português, auditoria universal, soft delete, dados pessoais em colunas sem cifra; documentos novos no Drive compartilhado privado e receita em comissões. Modelos antigos só permanecem nas migrations/histórico.

Migration 1789516800000 exige complementos reais e backup; use apenas os comandos npm documentados (executor sanitizado). Não editar migrations aplicadas nem imprimir dados privados. A chave antiga é necessária só para decifrar o legado na migração. Nenhuma migration/deploy automático. Cookie Secure exige HTTPS no navegador. Adaptar frontend e health check /api/v1/saude antes da publicação conjunta. main e regra de confirmação antes de commit continuam vigentes.

## 2026-10-03 — Carga persistente do catálogo

`npm run seed:catalogo:simular` é somente leitura; `npm run seed:catalogo:executar` exige backup
completo verificado e pasta local com ACL restrita. Use conexão Neon direta (`--conexao-direta true`)
para a trava de sessão. Não imprimir `.env`, senha, CPF ou journal. O lote criou 12 imóveis
ilustrativos, 36 mídias e ADMIN Codice. Preços, áreas, características e endereços são sintéticos e
não provam disponibilidade comercial; confira `docs/2026-10-03-fontes-catalogo.md`. Uploads têm
hashes conferidos no R2; por HTTP 401 na URL pública vigente, `imoveis_midias.url` aponta às fontes
HTTPS licenciadas de `images.unsplash.com`. Não mudar a política do bucket nesta carga. Reexecução
ignora anúncios concluídos e pode reconciliar URLs somente quando chaves e ordem do journal conferem.
O snapshot confirmou que todas as linhas preexistentes foram preservadas.
