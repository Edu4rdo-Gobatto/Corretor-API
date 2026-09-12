# Entendendo o backend — corretor-api

> Material didático sobre o código da API. Escrito para quem sabe programar mas não
> conhece NestJS e TypeORM a fundo.
>
> **A fonte de verdade é o código.** Este documento foi produzido lendo os 60 arquivos
> de `src/` um a um, e cada afirmação passou por um revisor que tentou refutá-la abrindo
> o arquivo. Onde o texto e o código discordarem, o código ganha.
>
> Gerado em 12/09/2026, sobre o commit `38b0565`.

---

## Sumário

| # | Capítulo | Para quê |
|---|---|---|
| 0 | [O que é este sistema](#0-o-que-é-este-sistema) | produto, atores, serviços externos, os 22 endpoints |
| 1 | [Inicialização e configuração](#1-inicialização-e-configuração) | como o processo sobe — e os conceitos de NestJS |
| 2 | [O banco: 5 tabelas, 5 migrations](#2-o-banco-5-tabelas-5-migrations) | a forma dos dados, antes de qualquer módulo |
| 3 | [Vocabulário de segurança](#3-vocabulário-de-segurança) | hash, JWT, Bearer, cookie, CSRF, XSS |
| 4 | [Corretores (`agents`)](#4-corretores-agents) | a raiz do grafo |
| 5 | [Autenticação (`auth`)](#5-autenticação-auth) | login, refresh rotativo, guards |
| 6 | [O `AgentProfile`](#6-o-agentprofile-o-eixo-invisível) | o eixo que costura o sistema inteiro |
| 7 | [Imóveis (`properties`)](#7-imóveis-properties) | o núcleo do produto |
| 8 | [Mídia (`media`)](#8-mídia-media) | upload para o Cloudflare R2 |
| 9 | [Leads (`leads`)](#9-leads-leads) | contato público e LGPD |
| 10 | [Suporte](#10-suporte-senha-e-bootstrap) | senha e o comando de bootstrap |
| 11 | [Como este projeto se testa](#11-como-este-projeto-se-testa) | o terço do código que ninguém mostra |
| 12 | [Travessia: o ciclo de uma requisição](#12-travessia-o-ciclo-de-uma-requisição) | a ordem que ninguém enxerga |
| 13 | [Travessia: o que acontece quando você apaga](#13-travessia-o-que-acontece-quando-você-apaga) | CASCADE, RESTRICT, SET NULL |
| 14 | [Travessia: a corrente de segurança](#14-travessia-a-corrente-de-segurança) | releitura do sistema sob uma lente |
| 15 | [Receitas](#15-receitas) | como mexer sem quebrar |

---

## 0. O que é este sistema

### O produto

Um **catálogo de imóveis comerciais** — salas, lojas, galpões, prédios e terrenos. Duas metades:

- **A vitrine pública.** Qualquer visitante, sem login, navega o catálogo, abre um imóvel e manda
  uma mensagem de interesse.
- **O painel do corretor.** Quem tem conta cadastra imóveis, sobe fotos e vídeos, e lê os contatos recebidos.

### Os três atores

| Ator | Como se identifica | O que pode |
|---|---|---|
| **Visitante** | não se identifica | ver imóveis disponíveis, criar um lead |
| **AGENT** (corretor) | e-mail + senha | tudo do visitante, mais gerenciar **os seus** imóveis, mídia e leads |
| **ADMIN** | e-mail + senha | tudo do AGENT, em **qualquer** registro, mais criar e editar corretores |

Não existe cadastro público. A primeira conta nasce por linha de comando (`npm run bootstrap:admin`);
daí em diante só um ADMIN cria contas.

### A pilha

**NestJS 11** sobre Express, **TypeScript estrito**, **TypeORM 0.3**, **PostgreSQL 16**. Node `>=24 <25`.
São **2.272 linhas** de código em 60 arquivos, mais **1.054 linhas** de teste em 13. É pequeno:
dá para entender inteiro numa tarde.

### Os serviços externos, um parágrafo cada

**Neon** é um PostgreSQL 16 gerenciado na nuvem, que só aceita conexão por TLS. Este projeto não
tem "modo banco local": a validação de ambiente exige literalmente um host terminado em `.neon.tech`.
Isso é incomum e deliberado — voltaremos a isso no capítulo 1.

**Cloudflare R2** é armazenamento de objetos compatível com a API do Amazon S3. É por isso que o
projeto usa `@aws-sdk/client-s3` apontando para um endpoint que não é da Amazon, com `region: 'auto'`.
Um "bucket" é um balde de arquivos; um "objeto" é um arquivo dentro dele. **Bucket não tem pastas
de verdade**: `properties/abc-123/foto.jpg` é um nome de chave inteiro, com barras dentro. Essa
sutileza importa no capítulo 13.

**Render** (API) e **Vercel** (front) são os destinos de publicação planejados. **Nenhum dos dois
existe ainda** — o código já está preparado para eles (escutar em `0.0.0.0`, não gravar em disco),
mas não há deploy no ar. Se o texto falar de "produção", leia como "quando houver".

### O repositório irmão

Existe um front React + Vite em `../Corretor-web`, e ele não é um detalhe: o access token é assinado
com `audience: 'corretor-web'`, o `ALLOWED_ORIGINS` tem default `http://localhost:5173` (porta padrão
do Vite) e o CORS usa `credentials: true`. Essas três coisas existem **exclusivamente** por causa dele.

### Os 22 endpoints

Esta tabela não existe em nenhum outro lugar do projeto. Vale marcar a página.

| Método | Rota | Proteção | O que faz |
|---|---|---|---|
| POST | `/auth/login` | origem + rate limit | e-mail e senha → par de tokens |
| POST | `/auth/refresh` | origem | cookie → par de tokens novo |
| POST | `/auth/logout` | origem | revoga a sessão no servidor |
| GET | `/auth/me` | JWT | quem sou eu |
| GET | `/agents` | JWT + **ADMIN** | lista corretores |
| POST | `/agents` | JWT + **ADMIN** | cria corretor |
| PATCH | `/agents/:id` | JWT + **ADMIN** | edita corretor |
| GET | `/properties` | **pública** | catálogo, com filtros e paginação |
| GET | `/properties/:slug` | **pública** | um imóvel pelo slug |
| POST | `/properties` | JWT | cria imóvel |
| PATCH | `/properties/:id` | JWT | edita imóvel |
| DELETE | `/properties/:id` | JWT | apaga imóvel |
| GET | `/admin/properties` | JWT | meus imóveis (ADMIN vê todos) |
| GET | `/admin/properties/:id` | JWT | meu imóvel por id |
| POST | `/properties/:propertyId/media` | JWT | sobe até 20 arquivos |
| POST | `/properties/:propertyId/media/embed` | JWT | adiciona YouTube/Vimeo |
| PATCH | `/properties/:propertyId/media/reorder` | JWT | reordena a galeria |
| PATCH | `/properties/:propertyId/media/:mediaId/cover` | JWT | define a capa |
| DELETE | `/properties/:propertyId/media/:mediaId` | JWT | apaga uma mídia |
| POST | `/leads` | **pública** | registra um interessado |
| GET | `/admin/leads` | JWT | meus leads (ADMIN vê todos) |
| DELETE | `/admin/leads/:id` | JWT | apaga um lead |

Três coisas para notar já:

1. **Não há prefixo global.** Não existe `/api/v1`. O caminho é literalmente o que o `@Controller` diz.
2. **`/agents` não segue o padrão `/admin/*`.** As rotas `/admin/properties` e `/admin/leads` aceitam
   **qualquer autenticado** e filtram por dono lá dentro; `/agents` exige papel ADMIN de verdade.
   A nomenclatura sugere o contrário do que acontece. É a inconsistência mais confusa da API.
3. **Não existe `GET` de mídia.** O subsistema de mídia só **escreve**. A galeria chega ao cliente
   pelas rotas de imóveis, que carregam a relação. Procurar um `GET /media` é procurar o que não existe.

---

## 1. Inicialização e configuração

Este é o capítulo onde os conceitos de framework são explicados. Daqui em diante eles só serão citados.

### Os seis conceitos de NestJS que você precisa

**Módulo (`@Module`)** — uma caixa que declara o que existe dentro dela: `imports` (outras caixas de
que preciso), `controllers` (quem atende HTTP), `providers` (as classes de serviço) e `exports` (o que
deixo outras caixas usarem). Um módulo não tem lógica; é planta baixa.

**Provider e injeção de dependência** — quando você escreve
`constructor(private readonly properties: PropertiesService) {}`, você **não** instancia nada. O Nest lê
o tipo, procura quem oferece aquilo e entrega pronto. Isso é injeção de dependência, e é o que permite
os testes trocarem o repositório real por um falso sem tocar no service.

**Controller** — a classe que mapeia URL para método. `@Controller('properties')` + `@Get()` = `GET /properties`.
Neste projeto os controllers são **finos de propósito**: recebem, delegam ao service, devolvem.

**Guard** — responde a uma pergunta: *pode entrar nesta rota?* Devolve `true`, `false` (vira **403**) ou
lança exceção. Guards rodam **antes** de qualquer validação de corpo — guarde isso, é a fonte de metade
das confusões deste projeto.

**Pipe** — transforma e valida o que entra. O `ValidationPipe` global é o pipe deste projeto.

**DTO** (*Data Transfer Object*) — uma classe que descreve o formato aceito numa requisição, com
decorators de validação. Se o campo não está no DTO, ele não entra. Literalmente.

### E dois do TypeORM

**Entity** — uma classe anotada que mapeia uma tabela. **Ela não cria nada no banco.**
**Repository** — o objeto que executa consultas sobre uma entidade (`find`, `save`, `remove`).
**Migration** — um arquivo com o SQL que efetivamente cria ou altera o schema. É a migration que cria
tabela, não a entity. Em `properties/property.entity.ts` existe um `@Check(...)`; esse decorator
**não criou** a constraint — quem criou foi a migration. O decorator só informa o TypeORM.

### Os arquivos

#### `src/main.ts` — o ponto de entrada

23 linhas, e cada uma compra alguma coisa:

```ts
const application = await NestFactory.create(AppModule);
const configuration = application.get(ConfigService);
const httpServer = application.getHttpAdapter().getInstance();
httpServer.set('trust proxy', 1);
application.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
application.enableCors({ origin: allowedOrigins(configuration), credentials: true });
application.enableShutdownHooks();
await application.listen(configuration.getOrThrow<number>('PORT'), '0.0.0.0');
```

- **`trust proxy 1`** diz ao Express para confiar em **um** salto de proxy ao calcular `request.ip` a
  partir do header `X-Forwarded-For`. O `1` importa: confiar em todos deixaria qualquer cliente forjar
  o próprio IP. Essa única linha sustenta duas coisas em módulos distantes — a chave do rate limit de
  login e o `consentIp` gravado como prova de LGPD no lead.
- **`ValidationPipe` global** com três flags: `whitelist` remove campo que não está no DTO,
  `forbidNonWhitelisted` transforma essa remoção em **400**, e `transform` faz o DTO chegar como
  instância de classe de verdade (é o que habilita `@Type` e `@Transform`).
- **`enableCors`** usa `allowedOrigins`, função que mora em `src/auth/browser-origin.guard.ts`.
  Uma lista, dois consumidores — não existe o cenário de o CORS liberar o que o guard bloqueia.
- **`listen(PORT, '0.0.0.0')`** escuta em todas as interfaces, exigência de container.

**O que não existe aqui é tão informativo quanto o que existe:** não há `setGlobalPrefix`, nem
versionamento, nem `useGlobalGuards`, nem filtro de exceção customizado, nem `helmet`, nem
`cookie-parser`. Consequência direta: **toda proteção de rota é declarada à mão** com `@UseGuards`, e
**qualquer erro que não seja uma `HttpException` vira 500**.

> **Correção de um mito:** o `import 'reflect-metadata'` está na **linha 2** do `main.ts`, depois do
> import do guard de origem. Não é o primeiro import do arquivo. Funciona porque o pacote é idempotente
> e outras bibliotecas também o importam.

#### `src/app.module.ts` — o módulo raiz

Classe de corpo vazio; tudo está no decorator. Importa, nesta ordem: `ConfigModule.forRoot({ isGlobal, cache, validate })`,
`TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: createDatabaseOptions })` e os
cinco módulos de domínio. Não tem `controllers` nem `providers` próprios — é composição pura.

O `forRootAsync` existe porque as opções do banco dependem de algo que só existe em tempo de execução
(o `ConfigService` já validado). O `inject` é a lista de dependências que o Nest passa para a factory.

#### `src/config/env.validation.ts` — o contrato do ambiente

Trata o `.env` como entrada não confiável, com os mesmos decorators dos DTOs de requisição. Declara
**10 variáveis**, mas atenção à distinção que quase ninguém faz:

| Obrigatórias (6) | Com valor padrão (4) |
|---|---|
| `DATABASE_URL` | `PORT` = 3000 |
| `JWT_SECRET` (mínimo 32 caracteres) | `NODE_ENV` = development |
| `R2_ENDPOINT` | `JWT_EXPIRES_IN` = 15m |
| `R2_ACCESS_KEY_ID` | `ALLOWED_ORIGINS` = http://localhost:5173 |
| `R2_SECRET_ACCESS_KEY` | |
| `R2_PUBLIC_URL` | |

Faltar uma das quatro da direita **não** derruba nada.

A peça mais opinativa é o validador customizado `NeonDatabaseUrl`. Ele exige protocolo `postgres:`
ou `postgresql:`, host terminando em `.neon.tech`, usuário, senha, um banco no caminho, e `sslmode`
entre `require`, `verify-ca` e `verify-full`. E vai além: **rejeita qualquer parâmetro de query que
não seja `sslmode` ou `channel_binding`**, cada um aparecendo uma única vez. O motivo está no
comentário do código — parâmetros de query do driver `pg` conseguem sobrescrever a autoridade da
conexão e até desligar o TLS.

Quando algo falha, a mensagem cita **só nomes de campo**, nunca valores:
`Configuração de ambiente inválida: <campos>. Consulte .env.example.` O comentário explica: mensagens
de validador podem interpolar o valor, e o valor aqui é segredo.

> **Correção importante:** é tentador concluir que uma variável não declarada nessa classe fica
> invisível. **Não fica.** O `ConfigService.get()` tem fallback para `process.env`. A prova está no
> próprio repositório: `bootstrap-admin.config.ts` lê as quatro `BOOTSTRAP_ADMIN_*`, que não existem
> em `EnvironmentVariables`. O que a classe controla é o **boot** (variável inválida mata o processo)
> e a camada tipada — não a visibilidade das outras.

#### `src/config/database.config.ts` — a conexão

Duas funções. `createPostgresOptions(url)` é o núcleo: reabre a URL, **apaga** `sslmode`, `sslcert`,
`sslkey` e `sslrootcert`, e só então monta `ssl: { rejectUnauthorized: true }`. Por que apagar se a
validação já conferiu? Porque no driver `pg` os parâmetros da URL têm **precedência** sobre o objeto
`ssl` — validar não bastava, era preciso remover. Também fixa `synchronize: false`, `migrationsRun: false`
e `installExtensions: false` (o Postgres 16 já traz `gen_random_uuid()`, então o boot não precisa
executar `CREATE EXTENSION`).

A segunda, `createDatabaseOptions(config)`, é a usada pelo Nest: lê a URL, delega, e acrescenta
`autoLoadEntities: true`.

#### `package.json`, `nest-cli.json`, `tsconfig.json`

O `package.json` fixa `engines: { node: ">=24 <25", npm: ">=11" }` — e o `.nvmrc` com `24` é o par
disso, para o nvm escolher a versão certa. As dependências de produção são 19, e a lista é uma
declaração de princípios: um ORM (TypeORM), um validador (class-validator), um hasher (argon2). O
`tsconfig.json` liga `strict` e, crucialmente, `emitDecoratorMetadata` — sem ele o `ValidationPipe`
não descobriria o tipo dos parâmetros e nada disso funcionaria. O `tsconfig.build.json` faz uma coisa
só: estende o anterior e redefine `exclude` (`node_modules`, `dist`, `**/*.spec.ts`, `src/testing`).
É a razão de as fixtures de teste nunca irem para produção.

Não citado em lugar nenhum mas importante: **`eslint.config.mjs`** usa `tseslint.configs.recommendedTypeChecked`
com `parserOptions.project`. É lint **com informação de tipo** — mais lento, e com regras que só
existem por saber o tipo (`no-floating-promises`, `no-unsafe-assignment`). É isso, e não só o `strict`,
que sustenta a regra "não use `any`" do projeto.

---

## 2. O banco: 5 tabelas, 5 migrations

### Antes de tudo: quem manda no schema

`synchronize: false` e `migrationsRun: false`. O TypeORM **nunca** altera o banco sozinho — nem no
boot, nem quando você muda uma entidade. As entidades são o mapa que o ORM usa para montar SQL; quem
cria coluna, chave e índice são as migrations, e **as cinco já foram aplicadas no Neon em 11/09/2026**.

Duas consequências práticas, e elas mordem:

1. Se entidade e migration discordarem, quem manda é a migration — e o código simplesmente não
   enxerga o que está no banco.
2. Um decorator novo numa entidade **não tem efeito nenhum** até virar migration. O erro aparece em
   tempo de execução, não de compilação.

### Conceitos de banco que o código usa

- **`timestamptz`** — todas as colunas de data são assim. Significa armazenamento normalizado em UTC.
  Importa para `consentTimestamp`, para os filtros de data dos leads e para `expires_at`.
- **`numeric` vs `float`** — dinheiro e área usam `numeric`, que é exato. `float` erraria centavos.
  O preço disso: o driver devolve `numeric` como **string**, para não perder precisão.
- **`jsonb`** — coluna que guarda JSON e o banco sabe indexar. Usada em `features`.
- **enum nativo** — `CREATE TYPE ... AS ENUM`. O Postgres recusa valor fora da lista.
- **Índice composto e a regra do prefixo mais à esquerda** — um índice em `(status, created_at)`
  serve consultas que filtram por `status`, ou por `status` **e** `created_at`. **Não** serve uma que
  filtre só por `created_at`. É por isso que a ordem das colunas não é arbitrária, e é a regra que
  permite você criar o próximo índice sem decorar os existentes.
- **Transação** — um bloco de operações que acontece inteiro ou não acontece. **Condição de corrida**
  é quando duas requisições simultâneas leem o mesmo estado e ambas decidem errado.

### `agents` — a raiz de tudo

Única tabela sem chave estrangeira. Todo o resto pendura nela.

- `id uuid PK DEFAULT gen_random_uuid()`
- `email text` com unique **e** `CHECK ("email" = lower(btrim("email")))`. O banco recusa e-mail com
  maiúscula ou espaço nas pontas. Não é capricho: sem isso, `Joao@x.com` e `joao@x.com` seriam duas
  linhas e o login viraria loteria.
- `password_hash text NOT NULL`, mapeado com **`select: false`** — nenhum `find` traz o hash por
  padrão. Só `AgentsService.findForAuthentication` o pede explicitamente.
- `role` do enum `AgentRole ('ADMIN','AGENT')`, default `AGENT`
- `active boolean DEFAULT true`, `whatsapp_number`, `creci` (nulo), `avatar_url` (nulo), `created_at`

**O que não existe:** `updated_at`, `deleted_at`, e **nenhuma rota DELETE**. Corretor não se apaga.

### `properties` — o catálogo

Três enums (`PropertyType`, `PropertyPurpose`, `PropertyStatus`) e a tabela.

- `slug text` único, gerado no service como `${títuloEmSlug}-${uuid}`. Como o sufixo é o UUID,
  colisão é improvável por construção. E o slug é **estável**: `CreatePropertyDto` não tem campo
  `slug`, então mudar o título **não** muda a URL pública e nenhum link quebra.
- `price numeric(12,2)`; `condo_fee`, `iptu_fee`, `usable_area` e `total_area` são `numeric(10,2)`.
  (Não é "dinheiro 12,2 / área 10,2" — só o preço tem a precisão maior.)
- `features jsonb NOT NULL DEFAULT '{}'` — campo livre, sem schema em lugar nenhum.
- Dois CHECKs: áreas (`usable_area > 0 AND total_area >= usable_area`) e preços não negativos.
- `agent_id uuid NOT NULL` com **ON DELETE RESTRICT**.
- Dois índices: `(agent_id)` e `(status, created_at)` — o segundo é exatamente a forma da consulta pública.

### `property_media` — filhas descartáveis

- `property_id` com **ON DELETE CASCADE** — a única CASCADE do domínio.
- `url text NOT NULL` e `storage_key text` **nulo**. A nulidade distingue os dois tipos: upload para o
  R2 grava uma chave; embed de YouTube grava `null`.
- `order_index integer DEFAULT 0`, `is_cover boolean DEFAULT false`.
- Índice em `(property_id, order_index)`.

**Não existe constraint nenhuma sobre `is_cover` nem sobre `order_index`.** Capa única e ordem
contínua são garantidas só pelo código. Voltaremos a isso.

### `leads` — memória que sobrevive

A tabela com o desenho mais interessante, porque as duas FKs têm comportamentos **opostos**:

- `property_id` **nulo**, com **ON DELETE SET NULL**
- `agent_id NOT NULL`, com **ON DELETE RESTRICT**
- Bloco LGPD: `consent_given`, `consent_timestamp`, `consent_ip`, `terms_version DEFAULT 'v1.0'`
- Três índices: `(agent_id, created_at)`, `(property_id, created_at)` e `(created_at)` — os três
  correspondem a caminhos reais da listagem.

`consent_given` é `NOT NULL` mas **não tem CHECK exigindo `true`**. A garantia está só no código.

### `refresh_sessions` — a exceção

```sql
CREATE TABLE refresh_sessions (
  token_hash text PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
)
```

Foge do padrão em três pontos: **não há coluna `id`** (a PK é o próprio hash do token), a FK é escrita
inline sem nome, e a classe da migration é a única que não declara `name`.

E a diferença que mais importa: a entidade `RefreshSession` tem só `@PrimaryColumn` e dois `@Column`.
**Não há `@ManyToOne` para `Agent`.** A FK existe no banco e é invisível para o ORM. Quem ler só a
entidade conclui, errado, que não há relação com `agents`.

> Duas das cinco migrations não criam enum nenhum: a de `leads` e a de `refresh_sessions`.

### `src/database/data-source.ts`

Um `DataSource` usado **exclusivamente** pelo CLI (`migration:show`, `migration:run`, `migration:revert`).
Lista as 5 entidades e as 5 migrations explicitamente, com `migrationsTableName: 'typeorm_migrations'`.
Compare com o runtime, que usa `autoLoadEntities: true`.

> O arquivo usa `export default`, mas **não por exigência do CLI** — o TypeORM varre todas as chaves
> exportadas e aceita a única que for um `DataSource`.

---

## 3. Vocabulário de segurança

Duas páginas que destravam os dois capítulos seguintes.

**Hash** é uma função de mão única: da senha você chega no hash, do hash você não volta. É por isso
que o banco guarda `password_hash` e ninguém — nem o dono do sistema — consegue ler a senha de volta.
**Salt** é um valor aleatório misturado antes de hashear, para que duas pessoas com a mesma senha
gerem hashes diferentes. **Ataque de dicionário** é testar milhões de senhas comuns contra um hash
vazado; é contra isso que existem hashes deliberadamente **lentos**, como o Argon2id.

**JWT** (*JSON Web Token*) são três partes separadas por ponto: `cabeçalho.payload.assinatura`. As
duas primeiras são **base64url — legíveis por qualquer um**. Isso significa que o `role` que viaja
dentro do token **não é segredo**; ele só é **inviolável**, porque alterá-lo quebra a assinatura.
**HS256** é simétrico: o mesmo `JWT_SECRET` assina e verifica. Guarde a consequência: quem descobre
o segredo emite tokens de ADMIN à vontade — daí o mínimo de 32 caracteres.

**Bearer** é o esquema do header `Authorization: Bearer <token>`: "quem portar isto, é". O navegador
**não** envia esse header automaticamente.

**Cookie `httpOnly`** é um cookie que o JavaScript da página **não consegue ler**. O navegador o envia
sozinho a cada requisição para aquele domínio.

**XSS** é código malicioso rodando dentro da sua página; ele lê tudo que o JavaScript lê — daí o
`httpOnly`. **CSRF** é outro site fazendo o **seu** navegador disparar uma requisição autenticada
sem você saber; funciona justamente porque cookies vão sozinhos — daí o `sameSite: 'strict'` e o
guard de origem.

Note a simetria: o que protege de XSS (cookie ilegível por JS) é o que cria a exposição a CSRF
(cookie enviado sozinho). O projeto usa os dois mecanismos em pares por isso.

---

## 4. Corretores (`agents`)

> Este capítulo vem **antes** de auth de propósito. `AuthService.login` depende de
> `AgentsService.findForAuthentication`, a estratégia JWT depende de `findActiveById`, e o objeto que
> sai de tudo isso é o `AgentProfile`, definido aqui. Ler auth primeiro obriga a aceitar três
> dependências no escuro.

| Arquivo | O que faz |
|---|---|
| `agent.entity.ts` | mapeia a tabela `agents` e define o enum `AgentRole` |
| `agents.module.ts` | registra o repositório, o controller e o service — e **exporta** o service |
| `agents.controller.ts` | as três rotas de `/agents`, todas exigindo login **e** papel ADMIN |
| `agents.service.ts` | toda a regra: busca para login, listagem, criação, edição protegida |
| `dto/create-agent.dto.ts` | valida o corpo de `POST /agents`, normalizando nome e e-mail |
| `dto/update-agent.dto.ts` | versão parcial, com `active` e o default de `role` neutralizado |
| `dto/agent-query.dto.ts` | paginação da query string |
| `dto/agent-profile.dto.ts` | **o formato de saída** — a única porta entre a entidade e o HTTP |

### O que vale parar para ler

**`agents.module.ts` exporta o `AgentsService`.** É isso que permite `PropertiesModule` e `AuthModule`
injetarem esse service. Sem o `exports`, a injeção falharia no boot.

**`agents.controller.ts`** declara `@UseGuards(JwtAuthGuard, RolesGuard)` e `@Roles(AgentRole.ADMIN)`
**na classe**. Este é o **único** lugar do projeto que usa `RolesGuard`. Toda a demais distinção entre
ADMIN e AGENT não é feita por guard — é feita por filtro de dados dentro dos services.

**`agents.service.ts` — a proteção do último administrador.** É a joia do arquivo:

```ts
await manager.query('SELECT pg_advisory_xact_lock(741901)');
```

Um *advisory lock* do Postgres, dentro de uma transação, **antes** de contar os ADMINs ativos. Sem
ele, dois PATCH simultâneos rebaixando dois ADMINs diferentes passariam os dois na contagem (cada um
veria dois ativos) e o sistema ficaria sem administrador nenhum. Nenhuma constraint de banco consegue
expressar "pelo menos um ADMIN ativo"; o lock é o substituto.

**`agents.service.ts` — tradução de erro de banco.** `create` e `update` capturam `QueryFailedError`
e inspecionam `driverError.code === '23505'` (unique violado) para devolver **409** em vez de 500.
Onde ninguém traduz, erro de driver vira 500 — e não há filtro global de exceção neste projeto.

**`update-agent.dto.ts` — o override que evita um desastre.** `PartialType(CreateAgentDto)` herdaria
o default `role = AGENT`. Se herdasse, um PATCH parcial num ADMIN o **rebaixaria em silêncio**. O
arquivo sobrescreve `role` para `undefined` exatamente para impedir isso.

> **Correções:** o `@Check` na entidade **não criou** a constraint de e-mail — quem criou foi a
> migration. E o filtro em `update` é `filter(([key, value]) => key !== 'password' && value !== undefined)`:
> ele **mantém** o que é diferente de `undefined`.

---

## 5. Autenticação (`auth`)

| Arquivo | O que faz |
|---|---|
| `auth.module.ts` | junta dependências, providers e o controller de `/auth` |
| `auth.controller.ts` | as quatro rotas de sessão e o cuidado com o cookie |
| `auth.service.ts` | valida credenciais, rotaciona sessão, emite tokens |
| `session.service.ts` | ciclo do refresh token no banco: criar, consumir uma vez, revogar |
| `refresh-session.entity.ts` | mapeia `refresh_sessions` |
| `strategies/jwt.strategy.ts` | valida o Bearer e produz o perfil do corretor |
| `guards/jwt-auth.guard.ts` | liga uma rota à estratégia `jwt` |
| `guards/roles.guard.ts` | compara o papel do usuário com o exigido |
| `decorators/roles.decorator.ts` | carimba na rota quais papéis podem entrar |
| `browser-origin.guard.ts` | anti-CSRF das rotas que dependem do cookie |
| `login-rate.guard.ts` | limite de tentativas por IP e por conta |
| `dto/login.dto.ts` | contrato do `POST /auth/login` |

### Por que existem DOIS tokens

Esta é a pergunta número um de quem vê o login devolver um `accessToken` e mais nada aparentemente útil.

O **access token** é um JWT de 15 minutos. Vai no corpo da resposta, o front guarda **em memória** e
manda em `Authorization: Bearer` a cada chamada. Ele não é salvo em lugar nenhum — é verificável só
pela assinatura. Consequência: **não dá para revogá-lo**. A resposta do projeto é mantê-lo curto.

O **refresh token** é o oposto: opaco (`randomBytes(48)` = 384 bits de entropia), longo (30 dias),
e **guardado no banco**. Vai em cookie `httpOnly`, e nunca sai do cookie — `AuthController.setSession`
desestrutura `const { refreshToken, ...publicSession } = session` e devolve só o resto.

A divisão é: **o que é usado o tempo todo é curto e irrevogável; o que é usado raramente é longo e
revogável**. Um XSS no front rouba o access token (15 minutos de estrago) mas não alcança o refresh.

### O laço que o cliente faz

Esta é a pergunta prática de quem vai integrar, e ela não está escrita em nenhum outro lugar:

1. `POST /auth/login` → guarda o `accessToken` **em memória**; o cookie de refresh o navegador guarda sozinho.
2. Toda chamada leva `Authorization: Bearer <accessToken>`.
3. Uma chamada volta **401** → o access token expirou.
4. `POST /auth/refresh` — **sem** Bearer; vai só o cookie.
5. Recebe um par novo (o refresh antigo foi **queimado**), e repete a chamada original.

O passo 4 é de **uso único**, e é aí que mora a melhor linha do módulo.

### `session.service.ts` — a linha que vale o capítulo

```ts
DELETE ... WHERE token_hash = :hash RETURNING agent_id, expires_at
```

Em vez de `SELECT` e depois `DELETE`, um comando só. Como o `DELETE` é atômico no Postgres, se duas
requisições chegarem ao mesmo tempo com o mesmo token, **exatamente uma** recebe a linha; a outra
recebe vazio e leva 401. Não há janela de corrida, e a garantia vale **mesmo com várias instâncias
da API**, porque quem arbitra é o banco, não a memória do processo.

Antes disso, `consume` valida a forma com `/^[A-Za-z0-9_-]{64}$/` — lixo é descartado sem tocar no banco.

**Por que o token vira SHA-256 no banco, se senha usa Argon2?** Porque o problema é outro. Argon2 é
lento de propósito, contra dicionário sobre segredos escolhidos por humanos. Um token de 384 bits
aleatórios não tem dicionário. Em compensação o hash é a **chave primária** da tabela: precisa ser
determinístico para permitir busca indexada, e o salt aleatório do Argon2 tornaria isso impossível.
SHA-256 é a escolha certa aqui, e pelos motivos certos.

### `jwt.strategy.ts` — a decisão arquitetural mais interessante da API

O `validate` não confia no payload: confere que `sub` é UUID v4 e `exp` é número, e então
**vai ao banco**: `findActiveById(payload.sub)`. O comentário no código explica:
*"Authorization uses the current role, so deactivation/demotion takes effect immediately."*

Pense no que isso compra. O JWT **carrega** `role` no payload, mas esse `role` **nunca é usado para
autorizar**. O papel que chega em `request.user` foi lido do banco **agora**. Então desativar um
corretor invalida o token dele na requisição seguinte, sem esperar os 15 minutos; rebaixar um ADMIN
tira o poder na hora. Paga-se uma consulta por requisição autenticada e compra-se revogação imediata.

O `super({...})` fixa `algorithms: ['HS256']` (fecha a porta do ataque de troca de algoritmo e do
`alg: none`), `issuer: 'corretor-api'`, `audience: 'corretor-web'` e `ignoreExpiration: false`.

### `browser-origin.guard.ts`

Protege as três rotas que dependem do cookie. Duas regras: se veio `Origin`, tem que estar na lista
(string exata); se não veio `Origin` mas veio `Sec-Fetch-Site`, só `same-origin` e `none` passam.

Por que existe, se `sameSite: 'strict'` já barraria CSRF? Porque `sameSite` depende do **navegador**
respeitar a flag; a checagem de `Origin` acontece no **servidor**. Defesa em profundidade.

Note o que ele **não** faz: não exige que `Origin` exista. Um `curl` passa. O nome é
`BrowserOriginGuard` — o objetivo é impedir que *um navegador com sessão ativa* vire arma de um site
terceiro, não filtrar clientes.

E note por que as outras rotas não precisam dele: elas autenticam por `Authorization: Bearer`, e esse
header **não** é enviado automaticamente pelo navegador. Sem envio automático, não há CSRF.

### `login-rate.guard.ts`

Um `Map` em memória, duas chaves por requisição: `ip:<...>` com limite **50** e
`account:<sha256(email)>` com limite **10**, janela de 15 minutos. Dois eixos, não um: só por IP, uma
botnet distribui e passa; só por conta, um atacante que tenta uma senha em mil contas
(*password spraying*) passa. O limite por conta é mais apertado porque num escritório atrás de NAT
várias pessoas legítimas compartilham IP. O e-mail vira SHA-256 antes de virar chave — dado pessoal
não fica em claro na memória.

> **Correção que muda o entendimento:** guards rodam **antes** dos pipes, então este guard **nunca vê**
> o `LoginDto` transformado. Ele lê o corpo cru e faz a **própria** normalização
> (`email.trim().toLowerCase()`). O `@Transform` do DTO não tem efeito nenhum sobre a chave do rate limit.

### `auth.controller.ts`

`cookieOptions()` devolve `{ httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'strict', path: '/' }`.
As três rotas com token levam `@Header('Cache-Control', 'no-store')`.

Como não há `cookie-parser`, o método `readCookie` fatia o header à mão:

```ts
request.headers.cookie?.split(';').map(part => part.trim())
  .find(part => part.startsWith('corretor_refresh='))?.slice(17) ?? ''
```

O `.map(trim)` é **essencial**: sem ele, o cookie só seria encontrado quando fosse o primeiro do
header. E o `17` é o tamanho exato de `'corretor_refresh='` — renomear o cookie sem ajustar o número
quebra refresh e logout **em silêncio**, com 401 em vez de erro claro.

> **Correção:** `JWT_EXPIRES_IN` tem default `'15m'` na classe de ambiente, então o `getOrThrow` no
> módulo nunca lança por causa dele. Quem derruba a subida por `JWT_SECRET` ausente é a validação de
> ambiente, não o `getOrThrow`.

---

## 6. O `AgentProfile`: o eixo invisível

Uma página para a ligação mais importante do sistema — hoje partida em **onze arquivos**.

`src/agents/dto/agent-profile.dto.ts` é importado por: `auth.controller`, `auth.service`,
`jwt.strategy`, `roles.guard`, `agents.service`, `properties.controller`, `properties.service`,
`media.controller`, `media.service`, `leads.controller` e `leads.service`. Cinco módulos.

O fluxo é uma linha só:

```
JwtStrategy.validate  →  produz o AgentProfile (lido do banco, agora)
        ↓
Passport grava em request.user
        ↓
cada controller tipa com o seu AuthenticatedRequest local
        ↓
cada service recebe com o nome viewer
        ↓
ownerRestriction(viewer) / findOwnedProperty(viewer) / list(query, viewer)
        ↓
decidem o que EXISTE para aquele usuário
```

**Esse é o eixo de autorização da API.** Não há guard decidindo "pode editar este imóvel?" — há um
filtro entrando na cláusula `WHERE`.

Duas observações que só aparecem comparando os módulos:

**O tipo `AuthenticatedRequest = Request & { user: AgentProfile }` está escrito três vezes, idêntico** —
em `properties.controller.ts`, `media.controller.ts` e `leads.controller.ts`. É a duplicação mais
visível do repositório.

**`AuthModule` é importado por `MediaModule` e `LeadsModule`, mas não por `PropertiesModule` nem
`AgentsModule`** — e os quatro usam `JwtAuthGuard`. Se "importe `AuthModule` para usar o guard" fosse
a regra, metade do código estaria quebrado. Os dois funcionam porque `AppModule` importa `AuthModule`
na mesma árvore e o registro da estratégia é global ao Passport. A prova está nos testes:
`properties.http.spec.ts` precisa listar `AuthModule` **à mão** no módulo de teste, justamente porque
`PropertiesModule` não o traz.

`AgentProfile` é o tipo `Omit<Agent, 'passwordHash' | 'properties'>`, e `toAgentProfile` monta o objeto
**campo a campo**, sem spread. Construção explícita não vaza coluna nova por acidente.

---

## 7. Imóveis (`properties`)

O núcleo do produto e o maior módulo: 424 linhas.

| Arquivo | O que faz |
|---|---|
| `properties.module.ts` | registra o repositório, os **dois** controllers e o service |
| `properties.controller.ts` | rotas públicas e administrativas, delegando tudo |
| `properties.service.ts` | slug, permissão de dono, filtros, paginação, escrita |
| `property.entity.ts` | mapeia a tabela, com enums, índices, CHECKs e relações |
| `dto/create-property.dto.ts` | 17 campos validados um a um |
| `dto/update-property.dto.ts` | uma linha: `PartialType` torna tudo opcional |
| `dto/property-query.dto.ts` | paginação e filtros da query string |
| `dto/property-response.dto.ts` | decide **à mão** o que sai na resposta |

### Dois controllers, dois públicos

`PropertiesController` (`/properties`) tem `list` e `detail` **abertos** e `create`, `update`, `remove`
com `@UseGuards(JwtAuthGuard)` **no método**. `ManagedPropertiesController` (`/admin/properties`) tem o
guard **na classe**.

A diferença real está no service: o caminho público força
`{ status: DISPONIVEL, agent: { active: true } }`; o administrativo troca isso por `ownerRestriction(viewer)`.
Por isso o painel vê `RESERVADO` e `CONCLUIDO`, e o ADMIN vê os imóveis de todos.

### A autorização por dono

```ts
ownerRestriction(viewer) {
  return viewer.role === AgentRole.ADMIN ? {} : { agentId: viewer.id };
}
```

Essa restrição é fundida no `where` do `findOne`. **A diferença é de segurança, não de estilo:** quando
o filtro está no `WHERE`, o registro alheio simplesmente **não existe** para aquele usuário, e a
resposta é **404**, não 403. Um AGENT não descobre se o UUID que chutou pertence a outro corretor ou
não existe. É IDOR fechado por construção.

`resolveOwner` complementa: um não-ADMIN tentando atribuir imóvel a outro corretor leva **403**.

> **Correção importante:** o papel é checado em **dois** pontos, não um. Além de `resolveOwner`,
> `ownerRestriction` também o checa — e é ela que dá ao ADMIN o poder de **editar e apagar** imóvel
> alheio. Dizer que o papel só é visto em `resolveOwner` ensina errado sobre quem pode o quê.

### O slug

Gerado em `create`: normaliza NFD, remove diacríticos, minúsculas, troca não-alfanuméricos por `-`,
apara hífens, corta em 80 caracteres, cai para `'imovel'` se sobrar vazio, e concatena `-${uuid}`.
Um **slug** é o identificador legível que vai na URL pública, em vez do UUID cru:
`/imoveis/galpao-industrial-cuiaba-a1b2c3d4-...`. O `update` **nunca** recalcula — a URL é permanente.

### Detalhes que merecem parada

**`numericTransformer`** na entidade: o driver devolve `numeric` como string, então `price` chegaria
no JSON como `"12000.50"`. O transformer converte para `Number` na leitura. **Toda coluna `numeric`
nova precisa dele.**

**`toPropertyResponse`** é a decisão arquitetural mais consequente: **não existe** `ClassSerializerInterceptor`,
não existe `@Exclude()` em entidade nenhuma. A resposta é montada **à mão**, campo a campo. Do
corretor sai só `{ id, name, whatsappNumber, creci, avatarUrl }` — sem `email`, sem `role`, sem `active`.
Das mídias sai `{ id, type, url, orderIndex, isCover }` — **sem `storageKey`**.

A vantagem de serializar à mão: vazamento vira erro de escrita visível num arquivo só, em vez de
consequência silenciosa de esquecer um decorator.

> **Correção:** **não existe uma classe `PropertyResponseDto`.** O arquivo exporta uma única **função**,
> `toPropertyResponse`. Quem procurar pela classe não acha nada. E ela devolve dezenas de campos do
> imóvel — a restrição a cinco campos vale só para o `.map` das mídias.

**A assimetria entre query e corpo.** `PropertyQueryDto` tem `@Type(() => Number)` e aceita `page=2`
como string, porque query string é sempre texto. `CreatePropertyDto` **não tem** — no corpo JSON,
número tem que chegar número, e `"price": "12000.50"` dá 400. Esquecer o `@Type` num DTO de query novo
quebra a paginação inteira.

> **Mais correções:** `addressState` **não** tem `@Transform`, então `" SP "` é rejeitado em vez de
> aparado. `CreatePropertyDto` tem **17** campos. O `remove` devolve `void` e **não** chama
> `toPropertyResponse` — o controller responde 204. E o filtro de `undefined` no `update` é
> **defensivo**, não essencial: o TypeORM já ignora propriedades `undefined` no UPDATE; o filtro
> importa para o objeto em memória que vai virar JSON.

---

## 8. Mídia (`media`)

> **Comece por aqui: não existe `GET` neste módulo.** Ele só escreve. A galeria chega ao cliente pela
> relação `@OneToMany` de `Property`, serializada por `toPropertyResponse`. O subsistema de mídia
> **escreve** e o de imóveis **lê** — a ligação mais contraintuitiva do projeto.

| Arquivo | O que faz |
|---|---|
| `media.module.ts` | registra tudo e **cria o cliente S3** apontado para o R2 |
| `media.controller.ts` | as cinco rotas sob `/properties/:propertyId/media` |
| `media.service.ts` | dono, validação, gravação no R2, ordem, capa, limpeza |
| `property-media.entity.ts` | mapeia `property_media` |
| `dto/create-media-embed.dto.ts` | um campo `url`, obrigatoriamente https |
| `dto/reorder-media.dto.ts` | a lista completa de ids na nova ordem |

### O upload

`@UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 30 * 1024 * 1024 } }))` — o
**único** interceptor do projeto. Interceptors rodam **depois** dos guards, então o multipart só é
lido depois do JWT aprovado.

**Multipart/form-data** é o formato de requisição que carrega arquivos junto com campos. Detalhe que
importa: o `mimetype` é um campo de **texto que o cliente escreve** no envelope — não é deduzido do
conteúdo.

`validateFile` consulta o mimetype em dois mapas fechados (`image/jpeg`, `image/png`, `image/webp`;
`video/mp4`, `video/webm`) e a extensão devolvida vem **do mapa**, nunca do nome do arquivo enviado.
Com isso o `storageKey` fica `properties/<id-do-imóvel>/<uuid><extensão>`: **nenhum byte controlado
pelo cliente entra no caminho do objeto**, então não há traversal nem sobrescrita de objeto alheio.

E se algo falhar no meio de um lote, o `catch` apaga do R2 tudo que já subiu antes de relançar —
compensação manual, já que não há transação entre banco e bucket.

### Os embeds

`isSupportedEmbed` parseia a URL e compara o hostname (minúsculo, sem `www.`) por **igualdade exata**
com `youtube.com`, `youtu.be`, `vimeo.com`, `player.vimeo.com`. Comparar assim, em vez de
`url.includes('youtube.com')`, é o que impede `https://youtube.com.evil.net/...` de passar. É o erro
clássico nesse tipo de validação, e o código não o comete.

Embed grava `storageKey: null` — é a nulidade dessa coluna que distingue mídia hospedada de mídia externa.

> **Correções:** `listForProperty` é **público** e **não** chama `findOwnedProperty` — não faz checagem
> de dono nenhuma. Os cinco que fazem são `upload`, `addEmbed`, `reorder`, `setCover` e `remove`,
> justamente os que atendem rotas HTTP. E para carregar a relação `property` de uma mídia a opção
> seria `relations: { property: true }`.

---

## 9. Leads (`leads`)

**LGPD** é a Lei Geral de Proteção de Dados brasileira. As quatro colunas de consentimento existem
para **provar consentimento informado**: quem consentiu, quando, de onde, e sob qual versão dos termos.

| Arquivo | O que faz |
|---|---|
| `leads.module.ts` | o que importa, quais controllers expõe, qual service fornece |
| `leads.controller.ts` | uma rota pública para criar, duas protegidas para listar e excluir |
| `leads.service.ts` | valida consentimento, decide o dono, monta filtros, autoriza exclusão |
| `lead.entity.ts` | mapeia `leads` |
| `dto/create-lead.dto.ts` | o contrato do POST público |
| `dto/lead-query.dto.ts` | paginação, filtros de imóvel e data, busca textual |
| `dto/lead-response.dto.ts` | o formato de saída e a função que converte |

### O consentimento, em duas camadas

`CreateLeadDto` marca `consentGiven` com `@IsBoolean()` **e** `@Equals(true)`. E `LeadsService.create`
**confere de novo**. Redundância proposital: a coluna no banco é `NOT NULL` mas **não tem CHECK
exigindo `true`**, então as duas camadas de código são a única garantia real.

Ao gravar, o service carimba `consentTimestamp`, `consentIp` (que só é confiável por causa do
`trust proxy 1` lá do `main.ts`) e `termsVersion = 'v1.0'`.

O lead só é aceito se o imóvel existir com `status: DISPONIVEL` **e** corretor ativo.

### O que acontece quando um lead chega

**Nada.** Não há e-mail, WhatsApp, webhook ou notificação. O lead fica no banco esperando alguém abrir
`GET /admin/leads`. É a pergunta óbvia de quem lê um módulo chamado "leads", e a resposta honesta é
"por enquanto, nada".

### `escapeLike`

`value.replace(/[\\%_]/g, '\\$&')` antes do `ILike`. Isso **não** é proteção contra SQL injection —
disso o TypeORM já cuida, parametrizando tudo. É proteção contra **abuso de curinga**: sem escapar,
uma busca por `%` casaria com todos os registros. Defesa contra DoS por consulta, não contra injeção.

Note a diferença sutil: `LeadsService.list` usa `ILike('%termo%')` (busca parcial), enquanto
`PropertiesService.list` usa `ILike(cidade)` (casamento **exato** case-insensitive). `city=Cuiabá`
**não** encontra "Cuiabá Norte". Fácil confundir os dois.

> **Correções:** `?page=` vazio vira `0` (não `NaN`) e falha em `@Min(1)`. E, no TypeORM 0.3, uma
> condição aninhada em relação dentro do `where` **gera o JOIN automaticamente** — o
> `relations: { agent: true }` está ali porque o `create` usa o objeto carregado, não para habilitar
> o filtro.

---

## 10. Suporte: senha e bootstrap

| Arquivo | O que faz |
|---|---|
| `common/security/password.service.ts` | **único** ponto que gera e confere hash, com Argon2id |
| `common/security/password.module.ts` | registra e exporta o service |
| `commands/bootstrap-admin.ts` | o comando que cria o primeiro administrador |
| `commands/bootstrap-admin.config.ts` | traduz `BOOTSTRAP_ADMIN_*` num DTO validado, sem tocar no banco |

`PasswordService` tem duas funções e nada mais. Argon2id é a variante recomendada porque combina
resistência a GPU com resistência a ataques de canal lateral. Ter **um** lugar que sabe hashear é o
que garante que ninguém vai, por distração, gravar senha em claro numa rota nova.

O `bootstrap:admin` existe porque não há rota pública de cadastro inicial — e o comando **recusa
rodar se já existir algum ADMIN**. Ele valida as variáveis **antes** de conectar ao banco, e reporta
só nomes de variável.

> **Correção:** o bootstrap **passa pelo DTO**. `bootstrap-admin.config.ts` faz
> `plainToInstance(CreateAgentDto, ...)` seguido de `validateSync`, então o e-mail chega ao banco já
> normalizado e validado pelas mesmas regras de `POST /agents`. O CHECK do banco é rede de segurança
> para SQL manual, **não** para o bootstrap.

---

## 11. Como este projeto se testa

São **13 arquivos** `.spec.ts` e **1.054 linhas** — 31% do `src/`. A arquitetura de teste aqui **é**
uma decisão de arquitetura, e sem entendê-la você não escreve um teste novo.

### O mecanismo central

```ts
.overrideProvider(getRepositoryToken(Property)).useValue(new PropertyRepositoryFixture())
```

Os testes sobem uma **aplicação Nest de verdade** (`application.listen(0, '127.0.0.1')`) e trocam
**só** o repositório por uma fixture em memória. Ou seja: roteamento, guards, pipes, serialização e
regra de negócio são **reais**; só a fronteira do banco é simulada. É por isso que a suíte roda sem
Neon e sem rede.

As cinco fixtures em `src/testing/` são repositórios falsos. A de leads tem o interpretador de
operadores mais completo; a de mídia tem um **interruptor para simular falha de banco** no meio do
upload — é assim que se testa a compensação que apaga os objetos já enviados ao R2.

### As quatro suítes de contrato HTTP

`auth.http.spec.ts` (203 linhas), `properties.http.spec.ts` (173), `leads.http.spec.ts` (151) e
`media.http.spec.ts` (149). São a **única documentação executável** do comportamento das rotas.
Note: **não existe** `agents.http.spec.ts` — os testes HTTP de `/agents` moram dentro de `auth.http.spec.ts`.

Elas montam `ConfigModule` com `ignoreEnvFile: true` e `skipProcessEnv: true` (para não depender do
`.env` da máquina) e um `JwtService` próprio assinando com o mesmo issuer/audience de produção.

### O teste mais importante do repositório

`src/bootstrap.spec.ts` é o único que executa `src/main.ts` **de verdade**, num subprocesso via
`spawnSync`. Ele prova as duas garantias que o resto do documento apenas afirma: que o processo sai
com status 1 **antes** de conectar, e que a saída contém `DATABASE_URL` e `JWT_SECRET` mas **não**
contém os valores, nem `Unable to connect`, nem `Nest application successfully started`.

E `agent.entity.spec.ts` é o mais didático: ele prova que `password_hash` **não aparece no SQL gerado**,
transformando o `select: false` de promessa em fato verificado.

### A duplicação perigosa

A configuração do `ValidationPipe` está escrita **cinco vezes**: uma em `main.ts` e uma em cada uma
das quatro suítes HTTP. Mudar uma flag em produção sem mudar nos testes faz a suíte continuar verde
validando outra coisa.

### Como escrever um teste novo

1. Copie a montagem de uma suíte HTTP existente.
2. Se o seu service usa um método que a fixture não implementa, **ela quebra em tempo de execução, não
   de compilação**. Adicione o método na fixture.
3. `jest.config.cjs` tem 7 linhas e 5 opções; `testRegex: '\\.spec\\.ts$'` e `roots: ['<rootDir>/src']`.
   Não existe pasta `test/` nem suíte e2e: os specs moram ao lado do código que testam.

---

## 12. Travessia: o ciclo de uma requisição

### A ordem que o Nest executa

```
1. middleware do Express   (body parser, CORS)
2. guards                  ← canActivate
3. interceptors            (parte "antes")
4. pipes                   ← ValidationPipe e ParseUUIDPipe
5. o handler do controller
6. interceptors            (parte "depois")
7. serialização e envio
```

**A consequência que explica metade das confusões: guard roda ANTES de pipe.** Um `POST /properties`
sem token **e** com corpo inválido devolve **401**, nunca 400 — a validação sequer acontece. Ao
depurar, não conclua que o DTO está certo só porque não veio erro de validação: ele pode nem ter rodado.

Segunda consequência: guards enxergam `request.body` já parseado (o body parser é middleware), mas
**não** enxergam o DTO validado. É exatamente por isso que o `LoginRateGuard` lê o corpo cru.

### `GET /properties` — o caminho público

Roteamento (sem prefixo global, o caminho é literal) → **nenhum guard** → `ValidationPipe` monta o
`PropertyQueryDto` (defaults `page = 1` e `limit = 20` vêm dos inicializadores da classe; `@Type`
coage as strings; `@Max(100)` no limit é o freio) → handler delega ao service → service força
`{ status: DISPONIVEL, agent: { active: true } }` → `findAndCount` com ordenação
`createdAt DESC, id DESC` (o `id` é o desempate determinístico, sem ele duas linhas do mesmo instante
trocariam de página entre requisições) → `numericTransformer` converte os `numeric` → `toPropertyResponse`
decide o que sai → **200**.

### `POST /properties` — o caminho autenticado

Preflight CORS → body parser → `JwtAuthGuard` → `JwtStrategy.validate` **vai ao banco** → Passport
grava em `request.user` → **agora** o `ValidationPipe` → handler → service (`validateAreas` →
`resolveOwner` → `randomUUID` → slug → `repository.create` que **só instancia em memória** →
`save` que é o INSERT) → `toPropertyResponse` → **201**.

### Quem rejeita o quê

| Etapa | Status |
|---|---|
| validação de ambiente (boot) | processo sai com código 1 |
| `BrowserOriginGuard` | 403 |
| `LoginRateGuard` | 429 |
| `JwtAuthGuard` / `validate` | 401 |
| `RolesGuard` (retorna `false`) | 403 |
| `ValidationPipe` / `ParseUUIDPipe` | 400 |
| service: dono ou papel | 403 |
| service: não encontrado | 404 |
| banco: unique violado | **409 só onde há tratamento**, senão 500 |

---

## 13. Travessia: o que acontece quando você apaga

### O grafo, em uma frase

`agents` é a raiz. `properties` → `agents` (**RESTRICT**). `property_media` → `properties` (**CASCADE**).
`leads` → `properties` (**SET NULL**) **e** → `agents` (**RESTRICT**). `refresh_sessions` → `agents` (**CASCADE**).

Leia os `ON DELETE` em conjunto e eles contam uma história coerente:

> **corretor não se apaga** · **imóvel se apaga e leva a mídia junto** · **lead nunca se perde por
> causa de imóvel** · **sessão é descartável**

### Apagando um imóvel

1. As linhas de `property_media` desaparecem por CASCADE. **Não é o TypeORM fazendo isso** — não há
   `cascade: true` em `@OneToMany` nenhum. É o Postgres.
2. Os `leads` daquele imóvel têm `property_id` virando `NULL`. O lead **sobrevive**: nome, telefone,
   consentimento e `agent_id` continuam lá. É decisão de produto visível no schema — o histórico
   comercial e o registro de LGPD não podem evaporar porque um anúncio saiu do ar.

**E o que não acontece: os objetos no R2 continuam exatamente onde estavam.**

Este é o ponto cego do sistema e vale entender direito. `PropertiesService.remove` não chama
`MediaService`; `PropertiesModule` sequer importa `MediaModule`. Ao apagar o imóvel, as linhas de
`property_media` somem e levam junto o `storage_key` — que era o **único ponteiro conhecido** para o
objeto no bucket. O arquivo vira lixo permanente, sem índice, e você só o encontra listando o bucket
pelo prefixo `properties/<uuid-de-um-imóvel-que-não-existe-mais>/`.

**A regra prática: apague a mídia antes de apagar o imóvel.**

### Apagando um corretor

Não dá. Não há rota `DELETE`, e os dois `ON DELETE RESTRICT` bloqueariam a operação assim que o
corretor tivesse qualquer imóvel ou qualquer lead.

Note que a ausência da rota e o desenho das FKs são **a mesma decisão dita duas vezes**.

O mecanismo real é `active: false`, e ele atravessa quatro arquivos: `AgentsService.update` (com o
advisory lock), `JwtStrategy.validate` (derruba o token na hora), `AuthService.refresh` (não renova) e
os filtros `agent: { active: true }` do catálogo público (tira os imóveis da vitrine).

### Onde o banco não protege

1. **O R2 não tem chave estrangeira.** Nenhuma constraint do Postgres alcança um bucket.
2. **Capa única não é garantida.** Não há índice único parcial. Dois `PATCH .../cover` concorrentes
   podem deixar duas capas ou nenhuma — `setCover` não roda em transação explícita.
3. **`order_index` não tem unicidade.** Por isso `toPropertyResponse` ordena defensivamente com
   desempate por id.
4. **"Pelo menos um ADMIN ativo" só existe no código.** Um `UPDATE` direto no banco fura a regra.
5. **`consent_given = true` só existe no código.**
6. **`leads.agent_id` é denormalizado.** É uma cópia feita na criação. Se um ADMIN reatribuir o imóvel
   depois, os leads antigos continuam apontando para o corretor anterior. Pode ser intencional — quem
   atendeu foi o corretor da época — mas nenhum dos dois módulos revela isso sozinho.
7. **Sessões expiradas nunca são varridas.** O índice `idx_refresh_sessions_expiry` existe e **nenhum
   código o usa**. Está esperando uma limpeza que ninguém escreveu.

---

## 14. Travessia: a corrente de segurança

A segurança desta API não mora em nenhum arquivo. É uma corrente, e cada elo existe porque o anterior,
sozinho, não bastaria.

| Camada | Onde | Contra o quê |
|---|---|---|
| 0 | `env.validation.ts` | segredo curto, URL de banco adulterada, TLS desligado |
| 1 | `database.config.ts` | man-in-the-middle na conexão com o Neon |
| 2 | `main.ts` — `ValidationPipe` | **mass assignment** (mandar `slug`, `role`, `passwordHash`) |
| 3 | `password.service.ts` + `select: false` | vazamento de senha, mesmo com o banco comprometido |
| 4 | par de tokens + cookie `httpOnly` | XSS roubando sessão longa |
| 5 | `sameSite: 'strict'` + `BrowserOriginGuard` | CSRF (duas defesas, uma no cliente, uma no servidor) |
| 6 | `LoginRateGuard` | força bruta por IP e *password spraying* por conta |
| 7 | `JwtStrategy.validate` relendo o banco | JWT irrevogável |
| 8 | `RolesGuard` | acesso a rota por papel |
| 9 | `ownerRestriction` no `WHERE` | **IDOR** — e não serve de oráculo de existência |
| 10 | `to*Response` manual | vazamento de `email`, `role`, `storageKey` |
| 11 | `validateFile` + `isSupportedEmbed` | traversal de caminho, host enganoso |
| 12 | `@Equals(true)` + recheck no service | lead sem consentimento |

**O padrão:** cada camada é falível sozinha. O `sameSite` depende do navegador — por isso existe o
guard de origem. O JWT é irrevogável — por isso `validate` relê o banco. O `whitelist` depende de o
DTO estar certo — por isso `slug` e `passwordHash` também são impossíveis de setar pelo caminho do
service. **Segurança aqui não é uma parede: é a sobreposição das paredes.**

### As fragilidades conhecidas

Nenhum sistema é só virtudes. Estas são reais e estão no código hoje:

- **O rate limit é de instância única.** O `Map` vive na memória do processo. Duas instâncias = limite
  dobrado; todo deploy zera a contagem. Não há Redis nem `@nestjs/throttler`.
- **O teto de 10.000 chaves do rate limit é um DoS embutido.** Quando o mapa estoura, **toda** tentativa
  de login leva 429 — inclusive a legítima. Um atacante enche o mapa com e-mails aleatórios e tranca
  o login de todo mundo por até 15 minutos.
- **Enumeração de contas por tempo.** `login` só roda o Argon2 se o corretor existe e está ativo. A
  mensagem é sempre a mesma, mas o **tempo** não: e-mail inexistente responde muito mais rápido.
- **Não há detecção de reuso de refresh token.** Um token roubado e já consumido devolve 401, mas o
  sistema não revoga as outras sessões nem registra o evento.
- **O default é aberto.** Não existe guard global. Uma rota nova sem `@UseGuards` nasce pública e nada
  avisa. `PropertiesController` protege 3 dos 5 handlers, na mão.
- **`POST /leads` não tem rate limit nem guard de origem.** Spam de leads é possível à vontade.
- **Não há `helmet`.** HSTS, CSP e `X-Content-Type-Options` dependem do que o proxy à frente colocar.
- **`validateFile` confia no `mimetype` que o cliente envia.** Não há inspeção de magic bytes.

---

## 15. Receitas

### Rodar o projeto pela primeira vez

```bash
npm ci                      # instala (não precisa de rede além do registry)
cp .env.example .env        # e preencha — veja abaixo
npm run migration:run       # só se o banco for novo; no Neon já foram aplicadas
npm run bootstrap:admin     # cria o primeiro ADMIN; recusa se já houver um
npm run start:dev           # sobe em watch, na porta 3000
```

O `.env` de desenvolvimento **existe apenas na máquina do dono do projeto** e não é reconstruído por
agentes. As quatro `BOOTSTRAP_ADMIN_*` devem ser **removidas depois do uso**.

### Antes de commitar

```bash
npm run typecheck && npm run lint && npm test
```

Os três são obrigatórios pelo `AGENTS.md`. Código que compila não significa tarefa concluída.

### Adicionar um campo novo a um imóvel

Cinco lugares, **nesta ordem**:

1. **Migration nova.** Nunca edite as 5 aplicadas — altera o histórico de um banco real.
2. **A entidade** (`property.entity.ts`). Se for `numeric`, não esqueça o `numericTransformer`.
3. **O DTO de criação.** Sem isso, `forbidNonWhitelisted` devolve **400** para quem mandar o campo.
4. **`toPropertyResponse`.** Sem isso, o campo existe no banco e **não sai** na resposta.
5. **A fixture de teste**, se o seu código novo usar um método que ela não tem.

### Adicionar um endpoint novo

- Declare no controller, e **lembre do `@UseGuards(JwtAuthGuard)`** — o default é público.
- Se for rota pública de imóvel, replique `{ status: DISPONIVEL, agent: { active: true } }`. Não há
  nada no ORM impedindo você de esquecer e expor imóveis reservados.
- Se receber um id na URL, use `@Param('id', new ParseUUIDPipe({ version: '4' }))`.
- Rota autenticada que mexe em registro: passe `viewer` ao service e filtre no `WHERE`, não com um
  `if` depois de buscar.

### Adicionar uma variável de ambiente

Declare o campo em `EnvironmentVariables` com decorators, acrescente ao `.env.example` com um
comentário explicando o formato, e registre em `DECISIONS.md` — é exigência do projeto.

### Quem pode o quê, de uma vez

| Ação | AGENT | ADMIN |
|---|---|---|
| ver catálogo público | ✅ | ✅ |
| criar/editar/apagar imóvel | só os seus | **qualquer um** |
| atribuir imóvel a outro corretor | ❌ | ✅ |
| subir e apagar mídia | só nos seus imóveis | **qualquer um** |
| ver e apagar leads | só os seus | **todos** |
| listar, criar e editar corretores | ❌ | ✅ |
| apagar corretor | ❌ | ❌ (não existe) |

---

## Onde continuar

- **O código.** É a fonte de verdade, e são só 2.272 linhas.
- **`DECISIONS.md`** — por que cada escolha foi feita, e o que **não** fazer.
- **`AGENTS.md`** — o protocolo de trabalho do repositório.
- **`corretor-spec.json`** — a especificação de produto.
- **`docs/handoffs/`** — o registro da montagem de Neon e R2.

> ⚠️ **Não confie no `README.md` nem no `PLANO-PROJETO-CORRETOR.md`.** Os dois estão desatualizados em
> pontos conhecidos (o README descreve mídia e leads como "módulos vazios" e diz que as migrations
> criam duas tabelas, quando são cinco). O próprio `CLAUDE.md` do repositório avisa isso.
