# corretor-api

API REST do sistema da imobiliária de imóveis comerciais: catálogo público, contatos do site, painel dos
corretores, contratos de locação e comissões.

NestJS 11 sobre Express, TypeScript estrito, TypeORM 0.3 e PostgreSQL 16 no Neon. Mídia no Cloudflare R2 e
pastas de contratos no Google Drive compartilhado. Node `>=24 <25` e npm `>=11`.

Repositório irmão: **corretor-web** (React 18 + Vite 7 + SSR próprio), em `../Corretor-web`.

> A fonte de verdade é o código. Este README descreve a `main` em 09/10/2026 (commit `6b987a5`).

## Situação (09/10/2026)

- Contrato v2 em vigor desde 16/09: ids inteiros e cadastro único de pessoas.
- Banco do Neon recriado em 17/09 com as 10 migrations registradas. Em 03/10 recebeu a carga ilustrativa do
  catálogo: 12 imóveis, 36 mídias e um segundo ADMIN.
- Sessão de 4h por inatividade (06/10), foto do perfil (06/10) e as correções de 09/10 (CRECI, `tipo_id` em lista,
  pessoas elegíveis da comissão) estão na `main`.
- Ambiente de teste: API no Render e front na Vercel (`corretor-web-test.vercel.app`). Último registro de
  publicação da API: 08/10, commit `86ecf29`. O `6b987a5` ainda não foi publicado.
- Não há suítes de teste desde 03/10.

Estado detalhado em [PROJECT_STATUS.md](PROJECT_STATUS.md) e pendências em [TASKS.md](TASKS.md).

## Instalação

```bash
npm ci
cp .env.example .env   # preencha os valores; o .env nunca vai para o Git
```

Lint, tipos e build não precisam de `.env` nem de rede. Subir a API exige as variáveis obrigatórias e o Neon
acessível: não existe modo sem banco, e Postgres local é recusado.

## Comandos

| Ação | Comando | Precisa de `.env` e rede |
|---|---|---|
| Desenvolvimento com recarga | `npm run start:dev` | sim |
| Build | `npm run build` | não |
| Executar o build | `npm run start:prod` | sim |
| Lint | `npm run lint` | não |
| Tipos | `npm run typecheck` | não |
| Ver migrations | `npm run migration:show` | sim |
| Aplicar migrations | `npm run migration:run` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Reverter a última migration | `npm run migration:revert` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Criar o primeiro ADMIN | `npm run bootstrap:admin` | sim |
| Simular a carga do catálogo | `npm run seed:catalogo:simular -- --conexao-direta true --diretorio-privado <pasta>` | sim, só leitura no Neon |
| Executar ou retomar a carga | `npm run seed:catalogo:executar -- --conexao-direta true --diretorio-privado <pasta> --backup <arquivo>` | sim, Neon, R2 e backup |

`migration:*` e `bootstrap:admin` validam **todas** as variáveis antes de conectar, inclusive `JWT_SECRET` e as `R2_*`.

**`npm test` falha.** Não há arquivos de teste desde 03/10, e o `jest.config.cjs` não tem `passWithNoTests`.
O comando termina com "No tests found" e código 1. Isso não indica regressão. A decisão entre remover o Jest e
configurá-lo está na tarefa TEST-API.

Antes de commitar: `npm run typecheck`, `npm run lint` e `npm run build`.

### Carga do catálogo

O lote `catalogo:2026-10-03` é conteúdo ilustrativo persistente, não um modo alternativo da API. Antes de
executar, crie a pasta privada fora de sincronização em nuvem, restrinja a ACL e faça backup validado do banco.
A pasta guarda credenciais geradas, journal e cache de imagens; nunca a compartilhe. Fontes, licenças e a
natureza sintética dos anúncios estão em [2026-10-03-fontes-catalogo.md](2026-10-03-fontes-catalogo.md).

## Variáveis de ambiente

A validação (`src/config/env.validation.ts`) roda no boot. Valor inválido encerra o processo, e a mensagem cita só
o nome do campo. São 16 variáveis validadas:

| Variável | Regra | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Neon (`*.neon.tech`) com usuário, senha, banco e `sslmode=require`, `verify-ca` ou `verify-full`; só aceita os parâmetros `sslmode` e `channel_binding` | sim |
| `JWT_SECRET` | 32 caracteres ou mais | sim |
| `R2_ENDPOINT` | endpoint HTTPS S3 da conta Cloudflare, sem o bucket | sim |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | credenciais do token R2 | sim |
| `R2_PUBLIC_URL` | URL HTTPS base do bucket `corretor-midia` | sim |
| `PORT` | padrão `3000` | não |
| `NODE_ENV` | `development`, `test` ou `production`; padrão `development` | não |
| `JWT_EXPIRES_IN` | número seguido de `s`, `m`, `h` ou `d`; padrão `15m` | não |
| `ALLOWED_ORIGINS` | origens exatas, separadas por vírgula, sem barra final; padrão `http://localhost:5173`; só HTTPS em produção | não |
| `R2_REQUEST_TIMEOUT_MS`, `R2_CONNECTION_TIMEOUT_MS` | padrões `30000` e `5000` | não |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_DRIVE_SHARED_DRIVE_ID` | Service Account e Drive compartilhado; as quatro juntas ou nenhuma; chave RSA de 2048 bits ou mais | não |

Lidas fora da validação, só pelos comandos de linha:

| Variável | Uso |
|---|---|
| `MIGRACAO_BACKUP_ARQUIVO` | caminho de um backup não vazio; exigido para executar ou reverter migrations |
| `MIGRACAO_COMPLEMENTOS_ARQUIVO`, `LEADS_ENCRYPTION_KEY` | só para migrar dados legados na `1789516800000`; o runtime não usa |
| `BOOTSTRAP_ADMIN_NAME`, `_EMAIL`, `_PASSWORD`, `_WHATSAPP`, `_CPF` | dados do primeiro ADMIN; **remover do `.env` depois do uso** |

O `.env.example` ainda lista `TESTE_LOCAL_DATABASE_URL`, que nenhum código usa desde a remoção dos testes.

## Rotas

Todas sob o prefixo `/api/v1`. Um middleware do `main.ts` acrescenta o prefixo a URLs que chegam sem ele, então as
rotas também respondem sem `/api/v1`. São 62 rotas.

| Área | Rotas | Acesso |
|---|---|---|
| Saúde | `GET /saude` | público; testa o banco com `SELECT 1` |
| Sessão | `POST /autenticacao/entrar`, `/renovar`, `/sair` | origem verificada; `entrar` com limite de tentativas |
| Perfil | `GET /autenticacao/eu`; `PATCH /autenticacao/eu` (JSON ou multipart com o campo `foto`); `PATCH /autenticacao/eu/senha` | JWT; os `PATCH` também verificam a origem |
| Foto do corretor | `GET /corretores/:id/foto` | público; proxy do R2 ou redirect 302 para URL externa |
| Corretores | `GET` e `POST /admin/corretores`; `GET`, `PATCH` e `DELETE /admin/corretores/:id` | ADMIN |
| Classificações | `GET /tipos-imovel`, `/finalidades-imovel`, `/caracteristicas`; CRUD em `/admin/tipos-imovel`, `/admin/finalidades-imovel`, `/admin/caracteristicas` | leitura pública dos ativos; escrita ADMIN |
| Imóveis | `GET /imoveis`, `GET /imoveis/:slug`; `GET` e `POST /admin/imoveis`; `GET`, `PATCH` e `DELETE /admin/imoveis/:id` | público; no painel, todos leem e só o responsável ou ADMIN altera |
| Mídias | `POST /admin/imoveis/:imovel_id/midias` (multipart `arquivos`); `POST .../video-embed`; `PATCH .../ordem`; `PATCH .../:midia_id/capa`; `DELETE .../:midia_id` | responsável pelo imóvel ou ADMIN |
| Pessoas | `POST /pessoas`; `GET` e `POST /admin/pessoas`; `GET`, `PATCH` e `DELETE /admin/pessoas/:id` | site com consentimento; no painel, as próprias e as dos contratos intermediados |
| Contratos | `GET` e `POST /admin/contratos`; `GET`, `PATCH` e `DELETE /admin/contratos/:id`; `POST /admin/contratos/:id/pasta-drive` | intermediador ou ADMIN |
| Comissões | `GET` e `POST /admin/comissoes`; `GET /admin/comissoes/pessoas-elegiveis`; `GET` e `PATCH /admin/comissoes/:id` (com `versao_registro`; arquivar é `PATCH {ativo:false}`); `GET /admin/comissoes/:id/revisoes`; `PATCH /admin/comissoes/parcelas/:id/pagamento` | ADMIN, ou corretor responsável pelo imóvel e pela pessoa |
| Cadastros de contrato | `GET`, `POST` e `PATCH /admin/indices-reajuste` e `/admin/tipos-contrato` (desativar é `PATCH {ativo:false}`) | ADMIN |
| Opções de contrato | `GET /cadastros/indices-reajuste` e `/cadastros/tipos-contrato` (só ativos) | ADMIN e CORRETOR |

Convenções:

- Campos em português e `snake_case`. Ids são inteiros positivos; id inválido na URL responde 400.
- Listagens respondem `{ itens, total, pagina, limite, total_paginas }`, com `limite` máximo de 100.
- `DELETE` é exclusão lógica (`ativo = false`) e `PATCH { "ativo": true }` reativa. A exceção é a mídia, apagada
  do R2 e do banco. `DELETE` de corretor responde 200 com o perfil; os demais respondem 204.
- Valores monetários e áreas são texto decimal com até duas casas, por exemplo `"1500.00"`.
- Campo que não está no DTO responde 400 (`whitelist` e `forbidNonWhitelisted` no `ValidationPipe` global).
- Registro de outro corretor que a pessoa não pode ver responde 404, não 403.
- `tipo_id` em `GET /imoveis` e `/admin/imoveis` aceita um id ou uma lista separada por vírgula com até 20 ids.
  O cadastro do imóvel continua com um tipo só.
- `GET /admin/comissoes/pessoas-elegiveis?imovel_id=` devolve `{ id, nome }` das pessoas ativas do mesmo corretor
  do imóvel e sem vínculo com outro imóvel. O `POST` de comissão repete todas as checagens.
- CRECI: números com `J` ou `F` opcional no final (`^\d+[JF]?$`), em maiúsculas; vazio vira `null`.

## Sessão

- `POST /autenticacao/entrar` recebe `{ "email", "senha" }` e responde `{ token_acesso, tipo_token, corretor }`.
- O token de acesso é um JWT HS256 de 15 minutos, emissor `corretor-api`, audiência `corretor-web`. O front o
  mantém só em memória e o envia em `Authorization: Bearer`.
- O token de sessão vai no cookie `corretor_renovacao`: HttpOnly, Secure, SameSite=Strict, sem `maxAge` (some ao
  fechar o navegador). O banco guarda só o SHA-256, na tabela `sessoes_login`.
- A sessão expira após **4h sem requisições autenticadas**, sem limite absoluto. O `AtividadeSessaoInterceptor`
  global estende o prazo a cada requisição, gravando no máximo uma vez a cada 5 min.
- `POST /autenticacao/renovar` só estende o prazo e emite um JWT novo. **O token de sessão não muda** (sem rotação).
- O cargo é relido do banco a cada requisição: desativar ou rebaixar um corretor vale na hora.
- Revogam todas as sessões do corretor: trocar a própria senha, a redefinição de senha pelo ADMIN e a desativação.
  `sair` revoga só a sessão atual.
- Sessões expiradas são apagadas no boot e a cada hora, por `setInterval` no `SessoesService`.
- O cookie é sempre `Secure`: o login pelo navegador exige HTTPS, inclusive em desenvolvimento.
- Limites em memória do processo: login com 10 tentativas por conta e 50 por IP a cada 15 minutos;
  contato do site com 5 envios por minuto por IP.

## Estrutura

```text
src/
  main.ts            helmet, filtro global de erros, prefixo /api/v1, trust proxy, CORS, ValidationPipe, porta
  app.module.ts      configuração validada, TypeORM, agendador e os 9 módulos de domínio
  config/            validação do ambiente e opções de conexão com TLS verificado
  comum/             auditoria, validadores, decorators de DTO, datas e ArmazenamentoModule (cliente R2 e cota de upload)
  common/filters/    filtro global de exceções
  autenticacao/      login, renovação, saída, perfil, guards, estratégia JWT, sessões e interceptor de atividade
  corretores/        corretores, hash Argon2id, último ADMIN e foto do perfil
  cadastros/         tipos, finalidades e características do catálogo
  imoveis/           catálogo público e gestão interna
  midias/            upload para o R2 e vídeos do YouTube e Vimeo
  pessoas/           contato do site com LGPD e cadastro manual
  locacoes/          contratos de locação (importa o módulo drive)
  comissoes/         comissões, parcelas e pessoas elegíveis
  drive/             cliente do Google Drive e registro de pastas
  saude/             health check
  database/          DataSource do CLI, registro de entidades e migrations, logger sem dados pessoais
  commands/          bootstrap do ADMIN, executor de migrations e carga do catálogo
  testing/           mock do agendador, resto da configuração do Jest
```

## Banco de dados

- `synchronize` e `migrationsRun` são `false`. O schema só muda por migration explícita.
- Migration aplicada nunca é editada, renomeada ou apagada: crie uma nova e registre-a em
  `src/database/registros.ts`.
- Há 12 arquivos em `src/database/migrations/`. Onze estão registrados no CLI. A `1789084805000-hardening` está
  fora do registro e nunca roda. A `1789689600000-comissao-versionada-cadastros-contrato` (09/10) ainda não foi
  aplicada no Neon.
- As três últimas (`1789516800000-modelo-portugues`, `1789603200000-ids-inteiros-pessoas` e
  `1789689600000-comissao-versionada-cadastros-contrato`) recusam reversão. Voltar atrás exige restaurar backup.
- As migrations de 13/09 e 16/09 arquivam o modelo anterior nos schemas `legado_20260913` e `legado_20260916`,
  hoje vazios.
- Tabelas atuais: `corretores`, `sessoes_login`, `tipos_imovel`, `finalidades_imovel`, `caracteristicas`,
  `imoveis_caracteristicas`, `imoveis`, `imoveis_midias`, `pessoas`, `contrato`, `comissoes`,
  `parcelas_comissao`, `pastas_drive` e `typeorm_migrations`. Com a migration de 09/10: `comissao_revisoes`,
  `indices_reajuste` e `tipos_contrato`.
- Toda tabela de negócio tem `criado_em`, `alterado_em`, `criado_por` e `alterado_por`.

### Backup

Faça backup antes de qualquer mudança estrutural. A máquina tem Docker, mas não tem `pg_dump` nem `psql`
instalados: use a imagem `postgres:16`.

```bash
export PGURL="$(node -e "require('dotenv').config({quiet:true}); process.stdout.write(process.env.DATABASE_URL)")"
docker run --rm -e PGURL postgres:16 sh -c 'pg_dump --no-owner --no-privileges "$PGURL"' > backups/backup_$(date +%Y%m%d_%H%M).sql
unset PGURL
```

Os backups ficam em `backups/`, fora do Git. Restaurar um backup é o único caminho de volta das duas últimas
migrations.

## Mídia

- Bucket R2 `corretor-midia`, com nome fixo no código. Os uploads ficam em memória e vão direto ao R2, porque o
  disco do Render é apagado a cada reinício.
- Imóveis: JPEG, PNG e WebP até 10 MB; MP4 e WebM até 30 MB; até 20 arquivos e 60 MB por lote. O tipo é
  conferido pelos primeiros bytes. Chave `imoveis/{id}/{uuid}{extensão}`.
- O envio ao R2 acontece antes da transação do banco. Se a gravação falhar, os objetos enviados são apagados
  (compensação). A exclusão apaga a linha na transação e depois o objeto, sem baixar cópia; se o R2 falhar, só
  registra no log.
- Foto do perfil: uma imagem JPG, PNG ou WebP de até 10 MiB, chave `corretores/{id}/{uuid}.{extensão}`. A leitura
  pública é `GET /corretores/:id/foto`. Contrato em [2026-10-06-foto-perfil.md](2026-10-06-foto-perfil.md).
- No máximo 2 uploads simultâneos por processo, cota compartilhada entre mídias e foto; acima disso responde 429.
- Em 03/10 a URL pública configurada do R2 respondeu 401. Por isso a carga do catálogo grava em
  `imoveis_midias.url` as URLs licenciadas do Unsplash, mantendo cópias no R2.

## Google Drive

- Documentos de contrato ficam no Drive compartilhado privado, em
  `Imobiliária/Contratos/{numero_contrato} - {locatário}`, criada depois de salvar um contrato ATIVO.
- Requisitos: Drive API habilitada; a Service Account é membro do Drive compartilhado com permissão de criar e
  renomear pastas; a raiz é privada e pertence ao Drive informado. A API recusa pastas com permissão `anyone` ou
  `domain`.
- A criação é idempotente: o id da pasta é reservado no Google e registrado em `pastas_drive` antes de criar.
- Falha do Drive não desfaz o contrato: ele fica com `status_pasta_drive = FALHOU` e a rota `pasta-drive` tenta de
  novo. Sem as quatro variáveis, a API sobe e a criação responde 503.
- A integração com credenciais reais ainda não foi homologada.

## Documentação

| Documento | Conteúdo |
|---|---|
| [INDICE.md](INDICE.md) | lista de todos os documentos |
| [AGENTS.md](AGENTS.md) | regras, comandos e protocolo de trabalho |
| [ENTENDENDO-O-BACKEND.md](ENTENDENDO-O-BACKEND.md) | referência técnica do código, módulo por módulo |
| [GUIA-DE-ESTUDO.md](GUIA-DE-ESTUDO.md) | guia de estudo do projeto e do NestJS |
| [PROJECT_STATUS.md](PROJECT_STATUS.md), [TASKS.md](TASKS.md), [DECISIONS.md](DECISIONS.md), [CHANGELOG_AI.md](CHANGELOG_AI.md) | estado, tarefas, decisões e histórico |
| [Corretor-web](../../Corretor-web/docs/README.md) | documentação do front |
