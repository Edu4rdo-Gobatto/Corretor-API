# Instruções do projeto — corretor-api

## Contexto

API REST do sistema da imobiliária de imóveis comerciais. NestJS 11 sobre Express, TypeScript estrito,
TypeORM 0.3 e PostgreSQL 16 no Neon. Mídia no Cloudflare R2 via `@aws-sdk/client-s3`. Pastas de contratos no
Google Drive compartilhado. Node `>=24 <25` e npm `>=11`.

Repositório irmão: **corretor-web** (React 18 + Vite 7 + SSR próprio), em `../Corretor-web`.
Os dois compartilham a especificação `corretor-spec.json`, e cada um mantém a sua cópia dos arquivos de contexto.
Toda a documentação fica em `docs/`, em estrutura plana (decisão de 04/10).

## Comandos

| Ação | Comando | Precisa de `.env`/rede |
|---|---|---|
| Instalar dependências | `npm ci` | não |
| Desenvolvimento (watch) | `npm run start:dev` | sim (Neon) |
| Build | `npm run build` | não |
| Executar o build | `npm run start:prod` | sim (Neon) |
| Lint | `npm run lint` | não |
| Tipos | `npm run typecheck` | não |
| Ver migrations | `npm run migration:show` | sim |
| Aplicar migrations | `npm run migration:run` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Reverter a última migration | `npm run migration:revert` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Criar o primeiro ADMIN | `npm run bootstrap:admin` | sim |
| Simular a carga do catálogo | `npm run seed:catalogo:simular` | sim, só leitura |
| Executar a carga do catálogo | `npm run seed:catalogo:executar` | sim, com backup verificado |

`migration:*` e `bootstrap:admin` carregam o `.env` e validam **todas** as variáveis antes de conectar.

`npm test` e `npm run test:watch` existem, mas não há suítes: `npm test` sai com "No tests found" e código 1
(o `jest.config.cjs` não tem `passWithNoTests`). Ver TEST-API em `TASKS.md`.

A carga do catálogo exige `--conexao-direta true`, pasta privada com ACL restrita e backup completo verificado.
Não imprimir `.env`, senha, CPF ou journal. Detalhes em `README.md` e `2026-10-03-fontes-catalogo.md`.

Backup do banco (a máquina tem Docker, mas não tem `pg_dump` nem `psql`):

```bash
export PGURL="$(node -e "require('dotenv').config({quiet:true}); process.stdout.write(process.env.DATABASE_URL)")"
docker run --rm -e PGURL postgres:16 sh -c 'pg_dump --no-owner --no-privileges "$PGURL"' > backups/backup_$(date +%Y%m%d_%H%M).sql
unset PGURL
```

## Regras

**Segredos e ambiente**
- Nunca comitar `.env`, dumps, tokens ou credenciais. `.env`, `*.sql` e `backups/` já estão no `.gitignore`.
- Não alterar variáveis de ambiente sem registrar em `DECISIONS.md` e avisar no `PROJECT_STATUS.md`.
- Não imprimir valores de segredo em log ou mensagem. Erros de configuração citam só nomes de campos.
- O `.env` de desenvolvimento existe na máquina do dono e **não** é reconstruído por agentes.

**Banco de dados**
- Só Neon. `DATABASE_URL` exige host `*.neon.tech`, usuário, senha, banco e `sslmode=require|verify-ca|verify-full`,
  aceitando só os parâmetros `sslmode` e `channel_binding`. Não existe modo sem banco.
- Há 12 arquivos de migration e 11 registrados em `src/database/registros.ts`. O banco foi recriado em 17/09 com as
  10 primeiras; a `1789689600000-comissao-versionada-cadastros-contrato` (09/10) ainda não foi aplicada no Neon
  (MIGRATION-20261009). A `1789084805000-hardening` fica fora do registro; não aplicar por suposição.
- Não edite, renomeie nem apague migration existente: crie uma nova. As três últimas recusam reversão.
- `synchronize` e `migrationsRun` continuam `false`.
- Faça backup antes de qualquer mudança estrutural e registre no `CHANGELOG_AI.md`.
- O banco contém o administrador real e a carga do catálogo de 03/10. Não apague dados sem autorização explícita.

**Mídia**
- O bucket R2 é `corretor-midia`, fixo no código. Uploads ficam em memória e vão direto ao R2; nada é gravado no
  disco do servidor, porque o filesystem do Render é efêmero.
- Pela API, excluir mídia apaga a linha e depois o objeto no R2. `DELETE /admin/imoveis/:id` só desativa o imóvel.
  Um `DELETE` direto no banco apaga as linhas de mídia por CASCADE e deixa os objetos órfãos no R2: apague a mídia antes.
- Não mudar a política de acesso do bucket sem decisão registrada.

**Código**
- Toda feature nova cabe em `entity + dto + service + controller` dentro de um módulo. Se não couber, discuta antes.
- Um padrão por problema: TypeORM como único ORM, `class-validator` + `class-transformer` como única validação.
  Não introduza Prisma, Drizzle, zod, Joi ou outro validador nesta API.
- O `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` e `transform`: todo campo novo precisa estar no
  DTO, senão a requisição responde 400.
- TypeScript estrito. Não use `any` nem `@ts-ignore` para contornar tipo.
- Não adicione dependência sem justificar em `DECISIONS.md`.
- Respostas públicas nunca expõem e-mail, `cargo`, hash de senha ou `chave_armazenamento`.
- Não recriar suítes de teste sem pedido do dono (decisão de 03/10). Validação é feita com typecheck, lint, build e
  QA efêmero fora do repositório.

**Fluxo de trabalho**
- O projeto trabalha **direto na `main`**, sem branches paralelas (decisão de 11/09).
- Antes de commitar: rode `npm run typecheck`, `npm run lint` e `npm run build`, confirme com o dono e nunca inclua
  segredo no commit.
- Código que compila não significa tarefa concluída: o critério está em `TASKS.md`.
- Para regras de produto, consulte `corretor-spec.json`.

## Protocolo entre agentes

Antes de trabalhar:

1. Ler `PROJECT_STATUS.md`, `TASKS.md`, `DECISIONS.md` e o último registro de `CHANGELOG_AI.md`.
2. Verificar o Git: `git status`, `git log --oneline -5` e se a branch está sincronizada com o remoto.
3. Conferir em `PROJECT_STATUS.md` se outro agente já assumiu a mesma área.
4. Registrar em `PROJECT_STATUS.md` a tarefa assumida, o seu nome e a data.

Depois de trabalhar:

1. Atualizar o bloco "Estado atual" do `PROJECT_STATUS.md`.
2. Registrar decisões em `DECISIONS.md`, com data, motivo e o que não fazer.
3. Acrescentar ao `CHANGELOG_AI.md` a tarefa, os arquivos, a validação com o resultado real e as pendências.
4. Informar riscos e pendências de forma explícita, inclusive o que ficou sem validação.

Divisão sugerida de papéis:

| Etapa | Agente | Responsabilidade |
|---|---|---|
| Planejamento | Claude | Entender o problema, propor arquitetura e critérios de conclusão em `TASKS.md` |
| Implementação | Codex | Alterar código e executar typecheck, lint, build e QA efêmero (sem criar suítes) |
| Revisão | Claude | Ler o diff, procurar bugs e falhas de segurança, registrar em `CHANGELOG_AI.md` |
| Correções | Codex | Aplicar os ajustes da revisão |
| Validação final | Ambos | Conferir build e estado do Git |

Não deixe os dois agentes editando a mesma área ao mesmo tempo.

## Mapa do código

```text
src/
  main.ts            # helmet, GlobalExceptionFilter, prefixo /api/v1 (aceita rotas sem prefixo), trust proxy 1,
                     # ValidationPipe global, CORS por ALLOWED_ORIGINS com credenciais, listen 0.0.0.0:PORT
  app.module.ts      # ConfigModule validado, TypeORM assíncrono, ScheduleModule e 10 módulos de domínio
  config/            # env.validation.ts (16 variáveis) e database.config.ts (TLS verificado, retryAttempts 3)
  database/          # data-source.ts do CLI, registros.ts (11 migrations), migrations/ (12 arquivos), log-seguro.ts
  commands/          # executor de migrations, bootstrap do ADMIN e carga do catálogo
  comum/             # auditoria, validadores, decorators de DTO, datas e ArmazenamentoModule (cliente R2 e cota de 2 uploads)
  common/filters/    # filtro global de exceções
  autenticacao/      # login, renovação sem rotação, saída, perfil (/eu), guards de origem, cargo e tentativas,
                     # estratégia JWT, sessoes_login e AtividadeSessaoInterceptor global (inatividade de 4h)
  corretores/        # CRUD de corretores (ADMIN), Argon2id em senhas.service.ts, último ADMIN, foto do perfil
  cadastros/         # tipos, finalidades e características
  cadastros-contrato/ # índices de reajuste e tipos de contrato (ADMIN) e opções ativas autenticadas
  imoveis/           # catálogo público por slug e gestão interna; filtros, ordenação e ficha interna
  midias/            # upload ao R2, embeds YouTube/Vimeo, ordem, capa e exclusão
  pessoas/           # contato do site com LGPD, cadastro manual e limite de 5 envios por minuto
  locacoes/          # contratos, expiração por cron e pasta no Drive
  comissoes/         # comissões, plano versionado, revisões, parcelas, baixa, cron de atraso e pessoas elegíveis
  drive/             # cliente do Google Drive e registro de pastas (entra via locacoes)
  saude/             # GET /saude
  testing/           # schedule.mock.ts, resto da configuração do Jest
```

Rotas e regras estão no `README.md`; a explicação módulo por módulo, no `ENTENDENDO-O-BACKEND.md`.

## Serviços externos

Último registro datado de cada serviço. Não presuma estado mais novo sem conferir.

| Serviço | Situação | Observação |
|---|---|---|
| Neon (PostgreSQL 16) | ativo; recriado em 17/09 com as 10 migrations; carga do catálogo em 03/10 | região São Paulo; conexão direta, sem pooler |
| Cloudflare R2 | ativo, bucket `corretor-midia` | em 03/10 a URL pública configurada respondeu 401; por isso a foto do perfil é servida pela API (06/10) |
| Render (API, teste) | serviço `Corretor-API` ativo | em 08/10 recebeu deploy manual do `86ecf29` e `/api/v1/saude` respondeu ok (registro no Corretor-web) |
| Vercel (front, teste) | `corretor-web-test.vercel.app` | publicado em 13/09; em 08/10 o proxy `/api` serviu a foto do perfil |
| Google Drive | não homologado | integração opcional; sem credenciais reais testadas |

Credenciais ficam apenas no `.env` local e no painel de cada serviço.
