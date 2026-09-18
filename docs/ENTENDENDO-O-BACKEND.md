# Entendendo o backend — corretor-api

> Referência técnica do código da API, módulo por módulo. Escrita para quem sabe programar mas não
> conhece NestJS e TypeORM a fundo.
>
> Reescrita em 17/09/2026 sobre o código da `main` no contrato v2: ids inteiros, cadastro único de pessoas,
> nomes em português. A versão anterior, de 12/09, descrevia o modelo em inglês (`agents`, `properties`,
> `leads`, UUID) e está no histórico do Git.
>
> **A fonte de verdade é o código.** Onde o texto e o código discordarem, o código ganha.
> Para estudo guiado, com plano e exercícios, use o [guia de estudo](GUIA-DE-ESTUDO.md).

---

## Sumário

| # | Capítulo | Para quê |
|---|---|---|
| 0 | O que é este sistema | produto, atores, serviços externos, as 60 rotas |
| 1 | Inicialização e configuração | como o processo sobe, e os conceitos de NestJS |
| 2 | O banco | tabelas, migrations e padrões de modelagem |
| 3 | Vocabulário de segurança | hash, JWT, Bearer, cookie, CSRF, XSS, IDOR |
| 4 | Corretores | a raiz do grafo |
| 5 | Autenticação | login, renovação rotativa, guards |
| 6 | O usuário autenticado | o eixo que costura a autorização |
| 7 | Cadastros | tipos, finalidades e características |
| 8 | Imóveis | o núcleo do produto |
| 9 | Mídias | upload para o Cloudflare R2 |
| 10 | Pessoas | contato do site, LGPD e cadastro único |
| 11 | Locações e Google Drive | contratos e pastas de documentos |
| 12 | Comissões | receita e parcelas |
| 13 | Suporte | comum, CLI de migrations, bootstrap, logger |
| 14 | Como o projeto se testa | a arquitetura de teste |
| 15 | Travessia: o ciclo de uma requisição | a ordem de execução |
| 16 | Travessia: o que acontece quando você apaga | exclusão lógica e física |
| 17 | Travessia: a corrente de segurança | as camadas e as fragilidades |
| 18 | Receitas | como mexer sem quebrar |

---

## 0. O que é este sistema

### O produto

Sistema de uma imobiliária de **imóveis comerciais**: salas, lojas, galpões, prédios e terrenos.

- **O site público.** O visitante navega o catálogo, filtra, abre um imóvel e envia um contato com consentimento LGPD.
- **O painel.** Corretores cadastram imóveis, fotos e vídeos, atendem pessoas, registram contratos de locação e
  controlam as comissões da imobiliária.

### Os atores

| Ator | Como se identifica | O que pode |
|---|---|---|
| Visitante | não se identifica | ver imóveis disponíveis e enviar contato |
| CORRETOR | e-mail e senha | ler todos os imóveis; alterar os seus; ver as pessoas que atende; contratos e comissões próprias |
| ADMIN | e-mail e senha | tudo, em qualquer registro, mais gerenciar corretores e classificações |

Não existe cadastro público. O primeiro ADMIN nasce por `npm run bootstrap:admin`; depois, só um ADMIN cria contas.

### A pilha

NestJS 11 sobre Express, TypeScript estrito, TypeORM 0.3, PostgreSQL 16. Node `>=24 <25`.
São 88 arquivos de produção, cerca de 3.600 linhas, e 27 arquivos de teste, cerca de 1.660 linhas.

### Os serviços externos

**Neon** é PostgreSQL 16 gerenciado, região São Paulo, acessado por TLS com conexão direta. A validação do
ambiente exige host terminado em `.neon.tech`: não existe modo com banco local.

**Cloudflare R2** é armazenamento de objetos compatível com o Amazon S3. Por isso o projeto usa
`@aws-sdk/client-s3` com `region: 'auto'` e endpoint da Cloudflare. Bucket fixo: `corretor-midia`.
Bucket não tem pastas de verdade: `imoveis/42/abc.jpg` é o nome inteiro de um objeto.

**Google Drive** guarda os documentos dos contratos num Drive compartilhado privado, acessado por uma Service
Account. A integração é opcional no boot.

**Render** (API) e **Vercel** (front) são os destinos de publicação. O Render roda hoje um commit com o contrato
anterior, incompatível com o banco atual.

### O repositório irmão

O front React + Vite fica em `../Corretor-web`. Ele explica três escolhas da API: o JWT com
`audience: 'corretor-web'`, o CORS com `credentials: true` e a lista `ALLOWED_ORIGINS`. O SSR do front chama a
API por um proxy `/api` que remove o prefixo; por isso a API aceita as rotas com e sem `/api/v1`.

### As 60 rotas

Todas sob `/api/v1`. "JWT" significa `AutenticacaoGuard`.

| Método | Rota | Proteção | O que faz |
|---|---|---|---|
| GET | `/saude` | pública | testa o banco com `SELECT 1` |
| POST | `/autenticacao/entrar` | origem + limite | e-mail e senha viram par de tokens |
| POST | `/autenticacao/renovar` | origem | cookie vira par de tokens novo |
| POST | `/autenticacao/sair` | origem | revoga a sessão; 204 |
| GET | `/autenticacao/eu` | JWT | perfil atual |
| PATCH | `/autenticacao/eu` | JWT + origem | altera nome, WhatsApp, CRECI e foto |
| PATCH | `/autenticacao/eu/senha` | JWT + origem | troca a própria senha e revoga as sessões |
| GET, POST | `/admin/corretores` | JWT + ADMIN | lista e cria corretores |
| GET, PATCH, DELETE | `/admin/corretores/:id` | JWT + ADMIN | lê, altera e desativa |
| GET | `/tipos-imovel`, `/finalidades-imovel`, `/caracteristicas` | pública | classificações ativas |
| GET, POST | `/admin/tipos-imovel`, `/admin/finalidades-imovel`, `/admin/caracteristicas` | JWT + ADMIN | lista todas e cria |
| GET, PATCH, DELETE | as mesmas, com `/:id` | JWT + ADMIN | lê, altera e desativa; 204 no DELETE |
| GET | `/imoveis` | pública | catálogo com filtros, ordenação e paginação |
| GET | `/imoveis/:slug` | pública | detalhe pelo id no fim do slug |
| GET, POST | `/admin/imoveis` | JWT | lista interna e criação |
| GET, PATCH, DELETE | `/admin/imoveis/:id` | JWT | ficha completa, alteração e desativação; 204 |
| POST | `/admin/imoveis/:imovel_id/midias` | JWT | até 20 arquivos no campo `arquivos` |
| POST | `/admin/imoveis/:imovel_id/midias/video-embed` | JWT | vídeo do YouTube ou Vimeo |
| PATCH | `/admin/imoveis/:imovel_id/midias/ordem` | JWT | nova ordem completa |
| PATCH | `/admin/imoveis/:imovel_id/midias/:midia_id/capa` | JWT | define a capa |
| DELETE | `/admin/imoveis/:imovel_id/midias/:midia_id` | JWT | exclusão física; 204 |
| POST | `/pessoas` | limite por IP | contato do site; responde `{ id }` |
| GET, POST | `/admin/pessoas` | JWT | lista e cadastro manual |
| GET, PATCH, DELETE | `/admin/pessoas/:id` | JWT | lê, altera e desativa; 204 |
| GET, POST | `/admin/contratos` | JWT | lista e cria contrato |
| GET, PATCH, DELETE | `/admin/contratos/:id` | JWT | lê, altera e desativa; 204 |
| POST | `/admin/contratos/:id/pasta-drive` | JWT | nova tentativa de criar a pasta no Drive |
| GET, POST | `/admin/comissoes` | JWT | lista e cria comissão com parcelas |
| GET, PATCH, DELETE | `/admin/comissoes/:id` | JWT | lê, altera observações ou `ativo`, desativa; 204 |
| PATCH | `/admin/comissoes/parcelas/:id/pagamento` | JWT | baixa manual de parcela |

Três coisas para notar já:

1. **O prefixo `/admin` não significa cargo ADMIN.** Só corretores, classificações e a escrita delas exigem ADMIN.
   Nas outras rotas `/admin`, qualquer corretor autenticado entra e o service filtra o que ele pode ver ou alterar.
2. **Não existe `GET` de mídia.** A galeria chega pelas rotas de imóvel.
3. **`DELETE` de corretor responde 200 com o perfil**, enquanto os outros `DELETE` respondem 204.

---

## 1. Inicialização e configuração

### Os conceitos de NestJS que você precisa

**Módulo (`@Module`)** declara `imports` (outros módulos), `controllers` (quem atende HTTP), `providers`
(classes injetáveis) e `exports` (o que outros módulos podem usar). Não tem lógica.

**Provider e injeção de dependência.** `constructor(private readonly imoveis: ImoveisService) {}` não instancia
nada: o Nest lê o tipo do parâmetro e entrega a instância pronta. É o que permite aos testes trocarem o repositório
real por um falso.

**Controller** mapeia URL para método. Aqui eles são finos: recebem, delegam ao service, devolvem.

**Guard** decide se a requisição pode entrar. Roda **antes** da validação do corpo.

**Pipe** transforma e valida a entrada. O `ValidationPipe` global é o principal; `ParseIntPipe` converte ids da URL.

**DTO** é a classe que descreve o formato aceito, com decorators de `class-validator` e `class-transformer`.
Campo fora do DTO não entra.

**Entity** mapeia uma tabela e **não cria nada no banco**. **Repository** consulta e grava. **Migration** é o SQL
que de fato cria e altera o schema.

### `src/main.ts`

```ts
const application = await NestFactory.create(AppModule);
application.use(helmet());
application.useGlobalFilters(new GlobalExceptionFilter());
application.setGlobalPrefix('api/v1');
application.use((request, _response, next) => {
  if (!request.url.startsWith('/api/v1')) request.url = `/api/v1${request.url}`;
  next();
});
httpServer.set('trust proxy', 1);
application.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
application.enableCors({ origin: ALLOWED_ORIGINS.split(','), credentials: true });
application.enableShutdownHooks();
await application.listen(PORT, '0.0.0.0');
```

- **`helmet()`** acrescenta headers de segurança: HSTS, `X-Content-Type-Options`, proteção contra clickjacking.
- **`GlobalExceptionFilter`** transforma qualquer erro em `{ statusCode, message }`. Erro que não é `HttpException`
  vira 500 genérico e só um código de falha vai ao log.
- **O middleware de reescrita** acrescenta `/api/v1` a URLs que chegam sem ele, para o proxy do front.
- **`trust proxy 1`** confia em um salto de proxy para calcular `request.ip` pelo `X-Forwarded-For`. Sustenta os
  limites por IP e o IP gravado no consentimento. Confiar em todos os saltos deixaria o cliente forjar o IP.
- **`ValidationPipe`**: `whitelist` remove campo desconhecido, `forbidNonWhitelisted` transforma isso em 400,
  `transform` entrega o DTO como instância de classe e ativa `@Transform` e `@Type`.
- **`enableShutdownHooks`** faz os métodos `onModuleDestroy` rodarem quando o processo recebe sinal de parada.
- **`listen(PORT, '0.0.0.0')`** escuta em todas as interfaces, exigência de container.

Não há guard global. Toda proteção é declarada com `@UseGuards`.

### `src/app.module.ts`

Importa `ConfigModule.forRoot({ isGlobal, cache, validate })`, `TypeOrmModule.forRootAsync(...)`,
`ScheduleModule.forRoot()` e os módulos de domínio: autenticação, corretores, cadastros, imóveis, mídias,
pessoas, locações, comissões e saúde. O módulo do Drive entra pelo de locações.

`forRootAsync` existe porque as opções do banco dependem do `ConfigService` já validado.

### `src/config/env.validation.ts`

Trata o ambiente como entrada não confiável, com os mesmos decorators dos DTOs.

| Obrigatórias | Com padrão | Opcionais em grupo |
|---|---|---|
| `DATABASE_URL` | `PORT` = 3000 | as quatro `GOOGLE_DRIVE_*` |
| `JWT_SECRET` (32 ou mais) | `NODE_ENV` = development | |
| `R2_ENDPOINT` | `JWT_EXPIRES_IN` = 15m | |
| `R2_ACCESS_KEY_ID` | `ALLOWED_ORIGINS` = http://localhost:5173 | |
| `R2_SECRET_ACCESS_KEY` | `R2_REQUEST_TIMEOUT_MS` = 30000 | |
| `R2_PUBLIC_URL` | `R2_CONNECTION_TIMEOUT_MS` = 5000 | |

O validador `NeonDatabaseUrl` exige protocolo `postgres:` ou `postgresql:`, host `.neon.tech`, usuário, senha,
banco e `sslmode` seguro, e **rejeita qualquer outro parâmetro de query**: no driver `pg`, parâmetros da URL
podem sobrescrever o host e até desligar o TLS.

Validações adicionais depois dos decorators:

- Em produção, `ALLOWED_ORIGINS` só aceita `https://`.
- As quatro variáveis do Drive vêm juntas ou nenhuma, e a chave privada precisa ser RSA de 2048 bits ou mais.

A mensagem de erro cita **só nomes de campo**. Mensagens de validador podem interpolar o valor, e o valor é segredo.

Uma variável não declarada nessa classe continua acessível pelo `ConfigService`, que recorre ao `process.env`.
A classe controla o boot e a tipagem, não a visibilidade.

### `src/config/database.config.ts`

`createPostgresOptions(url)` apaga `sslmode`, `sslcert`, `sslkey` e `sslrootcert` da URL e só então define
`ssl: { rejectUnauthorized: true }`, porque no `pg` os parâmetros da URL vencem o objeto `ssl`. Fixa
`synchronize: false`, `migrationsRun: false`, `installExtensions: false`, `logging: false`, o `LoggerSeguro` e
timeout de conexão de 10 segundos.

`createDatabaseOptions(config)` é a versão usada pelo Nest e acrescenta `autoLoadEntities: true` e `retryAttempts: 1`.

### `tsconfig.json`, `eslint.config.mjs`, `package.json`

- `strict: true` e `emitDecoratorMetadata: true`. Sem este último, o Nest não descobre os tipos dos parâmetros e
  a injeção de dependência não funciona. O `import 'reflect-metadata'` no `main.ts` é o par dele.
- `tsconfig.build.json` exclui `*.spec.ts` e `src/testing` do build de produção.
- O ESLint usa `recommendedTypeChecked`, lint com informação de tipo. Regras como `no-floating-promises` e
  `no-unsafe-assignment` sustentam a proibição de `any`.
- O `package.json` fixa `engines` e força `multer` 2.3.0 por `overrides`, para corrigir alertas de segurança da versão
  trazida pelo adaptador Express.

---

## 2. O banco

### Quem manda no schema

`synchronize: false` e `migrationsRun: false`: o TypeORM nunca altera o banco sozinho. Entity sem migration
compila e quebra em execução.

### As migrations

Registradas em `src/database/registros.ts`, nesta ordem:

| Migration | O que faz |
|---|---|
| `1789084800000` a `1789084804000` | modelo original em inglês: `agents`, `properties`, `property_media`, `leads`, `refresh_sessions` |
| `1789257600000`, `1789344000000`, `1789430400000` | locações, comissões de captação e pagamentos de aluguel do modelo intermediário |
| `1789516800000-modelo-portugues` | recria tudo em português com UUID e move o anterior para `legado_20260913` |
| `1789603200000-ids-inteiros-pessoas` | troca UUID por inteiro, funde clientes e partes em `pessoas`, move o anterior para `legado_20260916` |

- A migration de 13/09 lê um arquivo de complementos (`MIGRACAO_COMPLEMENTOS_ARQUIVO`) para dados que o modelo
  antigo não tinha, como CPF de corretores, e decifra dados legados com `LEADS_ENCRYPTION_KEY`. Com banco vazio,
  as cópias percorrem zero linhas e nada disso é necessário.
- A migration de 16/09 cria uma tabela temporária `mapa` que traduz cada UUID antigo para o inteiro novo, na
  ordem de criação, e ajusta as sequências de id no fim.
- As duas recusam reversão automática: o `down` lança erro.
- `1789084805000-hardening.ts` está no disco e fora do registro. Nunca roda.

Em 17/09/2026 o banco foi zerado e as 10 migrations rodaram do zero. Os schemas `legado_*` existem e estão vazios,
sem acesso pela API.

### As tabelas atuais

**`corretores`** — raiz do grafo. `email` único com `CHECK (email = lower(btrim(email)))`; `senha_hash` com
`select: false` na entity; `cpf` com 11 dígitos; `cargo` do enum `cargo_corretor` (`ADMIN`, `CORRETOR`);
`url_foto`, `creci`, `whatsapp`, `ativo`.

**`sessoes_login`** — a chave primária é o próprio `token_hash` (SHA-256 em hexadecimal, checado por regex no banco).
`corretor_id` com `ON DELETE CASCADE`; `expira_em`.

**`tipos_imovel`, `finalidades_imovel`** — `nome` e `slug` únicos, `ativo`. Seeds: Galpão, Sala Comercial, Prédio,
Loja, Terreno; Locação, Venda, Locação e Venda.

**`caracteristicas`** — `nome` único, `icone`, `ativo`.

**`imoveis_caracteristicas`** — chave composta `(imovel_id, caracteristica_id)`, `valor` livre (por exemplo "4 vagas")
e `ativo`. Imóvel com `CASCADE`, característica com `RESTRICT`.

**`imoveis`** — `titulo`, `slug` único, `tipo_id`, `finalidade_id`, `valor_venda` e `valor_locacao` opcionais,
`valor_condominio`, `valor_iptu`, `area_util`, `area_total`, endereço completo, `descricao` até 20.000 caracteres,
`status` (`DISPONIVEL`, `RESERVADO`, `VENDIDO`, `ALUGADO`, `RETIRADO`), `destaque`, `corretor_id`, `ativo`, e a
ficha interna: `proprietario_id`, `exclusividade`, `exclusividade_ate`, `data_captacao`, `chaves`, `matricula`,
`inscricao_municipal`, `observacoes_internas`, `motivo_baixa`. CHECKs de áreas e de valores não negativos.

**`imoveis_midias`** — `tipo` (`IMAGEM`, `VIDEO_EMBED`, `VIDEO_ARQUIVO`), `url`, `chave_armazenamento` com
`select: false`, `ordem`, `capa`. `CHECK (NOT capa OR tipo = 'IMAGEM')` e índice único parcial
`uq_imoveis_midias_capa ... WHERE capa = true`: no máximo uma capa por imóvel, garantida pelo banco.
`criado_por` é obrigatório.

**`pessoas`** — cadastro único. Contato (`nome`, `telefone`, `email`, `mensagem`), documento (`tipo_pessoa`,
`cpf_cnpj`, `data_nascimento`), `endereco`, dados bancários e `chave_pix`, `observacoes`, `imovel_id` com
`ON DELETE SET NULL`, `corretor_id` responsável, `origem` (`SITE`, `MANUAL`), `status_contato` (`PENDENTE`,
`RESPONDIDO`, `FINALIZADO`), bloco LGPD (`consentimento`, `consentimento_ip` com `select: false`,
`consentimento_em`, `versao_termos`) e `ativo`. Dois CHECKs:
`consentimento_site` (origem SITE exige consentimento e data) e `documento_coerente` (11 dígitos para PF, 14 para PJ).

**`contrato`** — `numero_contrato` único, `imovel_id`, `locador_id` e `locatario_id` apontando para `pessoas`,
`corretor_id` intermediador, datas, `valor_aluguel`, `dia_vencimento`, `taxa_administracao`, `garantia_locaticia`,
`indice_reajuste`, `cobranca_iptu_condominio`, `url_pasta_drive`, `status_pasta_drive`, `status` (`ATIVO`, `INATIVO`),
`observacoes`, `ativo`. CHECKs: partes distintas, fim depois do início, contrato desativado precisa estar INATIVO.
Índice único parcial `unico_contrato_ativo_imovel ... WHERE status = 'ATIVO'`.

**`comissoes`** — `tipo_operacao` (`LOCACAO`, `VENDA`), `contrato_id`, `imovel_id`, `pessoa_id`, `valor_total`,
`quantidade_parcelas` entre 1 e 600, `observacoes`, `ativo`. CHECK: locação exige contrato e venda não tem.

**`parcelas_comissao`** — `numero_parcela` único por comissão, `data_vencimento`, `valor`, `status` (`PENDENTE`,
`PAGO`, `ATRASADO`), `pago_em`, `observacao_pagamento`, `ativo`. CHECK: `PAGO` se e somente se `pago_em` preenchido.

**`pastas_drive`** — `chave` lógica única (por exemplo `contrato:7`), `id_drive` único, `pasta_pai_id`, `nome`, `ativo`.

### Padrões que atravessam todas as tabelas

- **Auditoria.** Toda entity herda de `Auditoria`: `criado_em`, `alterado_em`, `criado_por`, `alterado_por`.
  Os dois últimos apontam para `corretores` com `RESTRICT`.
- **Ids inteiros** com `GENERATED BY DEFAULT AS IDENTITY`.
- **Exclusão lógica** com `ativo`. Só mídias e sessões são apagadas de verdade.
- **`numeric` volta como string** do driver, para não perder precisão. O projeto mantém texto de ponta a ponta e
  calcula em centavos com `BigInt`.
- **Colunas `date`** circulam como `"2026-09-17"`. O "hoje" de negócio é calculado no fuso `America/Cuiaba`.
- **Busca textual** com a extensão `pg_trgm` e índices GIN em nome de corretor, título, cidade e bairro de imóvel,
  nome, telefone e documento de pessoa.
- **Índices compostos** seguem os caminhos reais de consulta, como `(ativo, status, criado_em)` no catálogo público.
  Lembre da regra do prefixo mais à esquerda: esse índice não serve a uma consulta que filtra só por `criado_em`.

### `src/database/data-source.ts` e `registros.ts`

O `DataSource` do CLI valida o ambiente, usa as mesmas opções de conexão e lista **explicitamente** entidades e
migrations a partir de `registros.ts`, com `migrationsTableName: 'typeorm_migrations'`. O runtime do Nest usa
`autoLoadEntities`. Entidade nova precisa entrar nos dois lugares: num `forFeature` e na lista `entidades`.

---

## 3. Vocabulário de segurança

**Hash** é função de mão única. O banco guarda `senha_hash` e ninguém recupera a senha a partir dele. **Salt** é um
valor aleatório misturado antes, para que senhas iguais gerem hashes diferentes. **Argon2id** é lento de propósito,
contra quem testa milhões de senhas.

**JWT** tem três partes: cabeçalho, conteúdo e assinatura. As duas primeiras são legíveis por qualquer um; o
conteúdo não é segredo, só é inviolável. **HS256** usa o mesmo `JWT_SECRET` para assinar e conferir: quem descobre o
segredo emite tokens de ADMIN.

**Bearer** é o esquema `Authorization: Bearer <token>`. O navegador **não** envia esse header sozinho.

**Cookie HttpOnly** não pode ser lido pelo JavaScript da página, e o navegador o envia sozinho.

**XSS** é código malicioso rodando na página; lê tudo que o JavaScript lê. **CSRF** é outro site fazendo o seu
navegador disparar requisição autenticada, porque cookies vão sozinhos. O que protege de um expõe ao outro: por isso
o cookie vem acompanhado de `SameSite=Strict` e do `OrigemGuard`.

**IDOR** é acessar registro alheio trocando o id na URL. Aqui a proteção é filtrar pelo dono no `WHERE`.

---

## 4. Corretores

| Arquivo | O que faz |
|---|---|
| `corretor.entity.ts` | mapeia `corretores` e exporta `perfilCorretor()`, o formato de saída |
| `corretores.module.ts` | registra repositório, controller e services; exporta `CorretoresService`, `SenhasService` e o `TypeOrmModule` |
| `corretores.controller.ts` | as cinco rotas de `/admin/corretores`, todas com `AutenticacaoGuard`, `CargosGuard` e `@Cargos('ADMIN')` na classe |
| `corretores.service.ts` | busca para login, listagem, criação, alteração protegida, perfil e senha |
| `corretores.dto.ts` | `CriarCorretorDto`, `AtualizarCorretorDto`, `AtualizarPerfilDto`, `AlterarSenhaDto`, `ConsultarCorretoresDto` e o enum `CargoCorretor` |
| `senhas.service.ts` | único ponto que gera e confere hash, com Argon2id |

Pontos que valem parar:

**A proteção do último administrador.** `atualizar` abre transação e executa `SELECT pg_advisory_xact_lock(741901)`
**antes** de ler e contar. Sem a trava, dois rebaixamentos simultâneos veriam dois ADMINs ativos e passariam, e o
sistema ficaria sem administrador. Nenhuma constraint expressa "pelo menos um ADMIN ativo". O mesmo número de trava
serializa o bootstrap do ADMIN e a troca de senha.

**O override que evita um desastre.** `AtualizarCorretorDto` herda de `PartialType(CriarCorretorDto)`, que traria o
padrão `cargo = CORRETOR`. Um PATCH parcial num ADMIN o rebaixaria sem aviso. O DTO sobrescreve
`cargo = undefined` para impedir isso.

**Perfil próprio sem elevação.** `AtualizarPerfilDto` usa `PickType` com só `nome`, `whatsapp`, `creci` e `url_foto`.
Mandar `cargo`, `email` ou `ativo` em `PATCH /autenticacao/eu` responde 400.

**Tradução de erro do banco.** `salvar` captura `QueryFailedError` com código `23505` (violação de unicidade) e
devolve 409 em vez de 500.

**`select: false` na senha.** `buscarParaAutenticacao` e `alterarSenha` pedem o hash explicitamente com a lista
`camposComSenha()`. Nenhuma outra consulta o traz.

**Validação.** CPF com dígitos verificadores (`@DocumentoValido`), WhatsApp brasileiro com ou sem 55, senha de 12 a
128 caracteres, foto só em URL HTTPS.

---

## 5. Autenticação

| Arquivo | O que faz |
|---|---|
| `autenticacao.module.ts` | registra o `JwtModule` (HS256, emissor, audiência, duração do ambiente), guards e services; exporta `AutenticacaoGuard` e `CargosGuard` |
| `autenticacao.controller.ts` | as seis rotas de sessão e perfil; lê e grava o cookie |
| `autenticacao.service.ts` | confere credenciais, emite o par de tokens, renova, sai, troca senha |
| `sessoes.service.ts` | cria, consome uma vez, revoga e limpa sessões |
| `sessao-login.entity.ts` | mapeia `sessoes_login` |
| `estrategia-jwt.ts` | confere o Bearer e produz o usuário autenticado |
| `autenticacao.guard.ts` | liga a rota à estratégia `autenticacao-jwt` do Passport |
| `cargos.guard.ts` | o decorator `@Cargos(...)` e o guard que o lê |
| `origem.guard.ts` | anti-CSRF das rotas que dependem do cookie e das alterações de perfil |
| `tentativas.guard.ts` | limite de tentativas de login |
| `autenticacao.dto.ts` | `EntrarDto` |

### Por que dois tokens

| | Token de acesso | Token de renovação |
|---|---|---|
| Formato | JWT HS256 com `sub` (id em texto) e `cargo` | 48 bytes aleatórios em base64url |
| Duração | `JWT_EXPIRES_IN`, padrão 15 minutos | 30 dias |
| No cliente | só em memória | cookie `corretor_renovacao`, HttpOnly, Secure, SameSite=Strict, Path=/ |
| No servidor | em lugar nenhum | SHA-256 em `sessoes_login` |
| Revogável | não, só expira | sim |

O controller desestrutura `const { token_renovacao, ...dados } = sessao`: o token de renovação nunca sai no corpo.

### O laço do cliente

1. `POST /autenticacao/entrar` e guarda `token_acesso` em memória. O cookie o navegador guarda sozinho.
2. Toda chamada leva `Authorization: Bearer <token_acesso>`.
3. Resposta 401 significa token expirado.
4. `POST /autenticacao/renovar`, sem Bearer, só com o cookie.
5. Recebe o par novo, com o cookie antigo queimado, e repete a chamada.

### `autenticacao.service.ts` e o hash de disfarce

`entrar` sempre roda o Argon2: se o e-mail não existe, confere a senha contra um hash gerado uma vez a partir de
bytes aleatórios. O tempo de resposta fica igual para e-mail existente e inexistente, e a mensagem é sempre
"E-mail ou senha inválidos." Sem isso, dava para descobrir quais e-mails têm conta medindo o tempo.

`alterarSenha` troca o hash e chama `revogarTodasDoCorretor`, derrubando todas as sessões de renovação.

### `sessoes.service.ts`

```ts
this.sessoes.createQueryBuilder().delete().where('token_hash = :hash', { hash })
  .returning(['corretor_id', 'expira_em']).execute();
```

Um comando só remove e devolve a sessão. Se duas renovações chegam juntas, exatamente uma recebe a linha; a outra
leva 401. Quem arbitra é o banco, então vale com várias instâncias. Antes disso, o token é conferido contra
`/^[A-Za-z0-9_-]{64}$/`, e lixo é descartado sem ir ao banco.

**Por que SHA-256 e não Argon2 no token?** Token de 384 bits aleatórios não tem dicionário, e o hash é a chave
primária: precisa ser determinístico para busca indexada.

`onModuleInit` liga um `setInterval` de uma hora que apaga sessões expiradas; `unref()` impede que ele segure o
processo vivo, e `onModuleDestroy` o desliga.

### `estrategia-jwt.ts`

`super({...})` fixa `algorithms: ['HS256']`, emissor, audiência e `ignoreExpiration: false`, fechando a porta da troca
de algoritmo e do `alg: none`. `validate` confere que `sub` é texto numérico e `exp` é número, e **relê o corretor
ativo no banco**. O cargo que chega em `request.user` vem do banco, nunca do token. Desativar ou rebaixar vale na
requisição seguinte. Paga-se uma consulta por requisição e compra-se revogação imediata.

### `origem.guard.ts`

Se veio `Origin`, ele precisa estar em `ALLOWED_ORIGINS` por igualdade exata. Se não veio, mas veio
`Sec-Fetch-Site`, só `same-origin` e `none` passam. Um `curl` sem esses headers passa: o objetivo é impedir que um
navegador com sessão seja usado por outro site, não filtrar clientes.

Aplicado em `entrar`, `renovar`, `sair`, `PATCH /eu` e `PATCH /eu/senha`.

### `tentativas.guard.ts`

Um `Map` em memória com duas chaves por requisição: `ip:<ip>` com limite 50 e `conta:<sha256(email)>` com limite 10,
janela de 15 minutos. Dois eixos porque só por IP uma botnet passa e só por conta um ataque de uma senha em mil
contas passa. O e-mail vira hash para não ficar em claro na memória. Estourou: 429 com `Retry-After: 900`.

O guard roda antes do `ValidationPipe`, então lê o corpo cru e faz a própria normalização do e-mail.

### `autenticacao.controller.ts`

Não há `cookie-parser`. `lerCookie` divide o header `Cookie` por `;`, apara cada parte e procura
`corretor_renovacao=`. As rotas de sessão levam `@Header('Cache-Control', 'no-store')`. `@Res({ passthrough: true })`
permite gravar o cookie e ainda deixar o Nest serializar o retorno.

O cookie é sempre `secure: true`: o login pelo navegador exige HTTPS também em desenvolvimento.

---

## 6. O usuário autenticado

`src/comum/usuario-autenticado.ts` define `{ id, nome, email, cargo }`. É o eixo de autorização:

```text
EstrategiaJwt.validate  → lê o corretor no banco, agora
        ↓
Passport grava em request.user
        ↓
cada controller tipa com Request & { user: UsuarioAutenticado } e repassa requisicao.user
        ↓
cada service recebe `usuario` e decide
        ↓
filtro no WHERE (pessoas, contratos, comissões) ou checagem de dono (imóveis, mídias)
```

Duas estratégias convivem, e a diferença importa:

- **Filtro no `WHERE`** (pessoas, contratos, comissões): o registro alheio não existe para o usuário e a resposta é
  **404**. Ninguém descobre se o id existe.
- **Checagem depois de buscar** (imóveis, mídias): todo corretor pode ler todos os imóveis internos, então o
  imóvel alheio é encontrado e a alteração responde **403**.

Os módulos que usam `AutenticacaoGuard` importam `AutenticacaoModule`, que exporta os guards.

---

## 7. Cadastros

| Arquivo | O que faz |
|---|---|
| `cadastros.entity.ts` | `TipoImovel`, `FinalidadeImovel`, `Caracteristica` (sobre a base abstrata `CadastroNomeado`) e `ImovelCaracteristica` |
| `cadastros.controller.ts` | fábricas `controladorPublico(categoria)` e `controladorAdministrativo(categoria)`, mais `CaracteristicasController` |
| `cadastros.service.ts` | CRUD genérico por categoria e a função `gerar_slug` |
| `cadastros.dto.ts` | DTOs de criação, alteração e consulta |

**Controllers fabricados por função.** Decorators são funções, então a mesma classe decorada é criada uma vez por
categoria. O módulo registra o array `controladoresCadastros`. É elegante e pouco comum.

A leitura pública traz só ativos; a administrativa traz todos. Slug gerado a partir do nome quando não informado.
Nome ou slug repetido, inclusive entre inativos, responde 409.

`gerar_slug` normaliza para NFD, remove acentos, passa a minúsculas, troca o que não é letra ou número por hífen e
corta em 100 caracteres. Também é usada pelos imóveis.

---

## 8. Imóveis

| Arquivo | O que faz |
|---|---|
| `imovel.entity.ts` | mapeia `imoveis` e o enum `StatusImovel` |
| `imoveis.controller.ts` | `ImoveisPublicosController` (`/imoveis`) e `ImoveisController` (`/admin/imoveis`, guard na classe) |
| `imoveis.service.ts` | listagem, detalhe, criação, alteração, slug, características, permissões |
| `imoveis.dto.ts` | `CriarImovelDto`, `AtualizarImovelDto`, `ConsultaImoveisDto`, `ConsultaInternaImoveisDto` |
| `imoveis.resposta.ts` | `resposta_imovel_publico`, `resposta_imovel` e `resposta_midia` |

### Público e interno

- O público força `imovel.ativo = true AND imovel.status = 'DISPONIVEL' AND corretor.ativo = true`.
- O interno aceita filtros extras: `status`, `ativo`, `corretor_id`, `proprietario_id`, `id`.
- Todo corretor autenticado lê qualquer imóvel interno. `verificar_edicao` exige dono ou ADMIN para alterar (403).
- Só ADMIN atribui imóvel a outro corretor.

### O slug

`titulo-normalizado-<id>`, por exemplo `galpao-na-br-163-42`. Para saber o id antes do INSERT, `criar` pede o
próximo valor da sequência com `nextval(pg_get_serial_sequence('imoveis', 'id'))`. `atualizar` recalcula o slug
quando o título muda. `encontrar_publico` confere o formato do slug, extrai o número do fim e busca pelo id: um link
com o título antigo continua achando o imóvel, e a resposta devolve o slug atual para o front redirecionar.

### Filtros e ordenação

Filtros: `tipo_id`, `finalidade_id`, `cidade` (igualdade sem diferenciar maiúsculas), `bairro` (parcial), `busca`
(título, bairro, cidade e descrição; `#12` ou `12` busca pelo id), `valor_min`, `valor_max`, `area_min`, `area_max`
(área útil) e `destaque`. Intervalos invertidos respondem 400.

`ordenar`: `recentes` (padrão), `valor_asc`, `valor_desc`, `area_asc`, `area_desc`. A coluna de preço depende da
finalidade filtrada: slug com "venda" usa `valor_venda`, com "loca" usa `valor_locacao`, e o resto usa
`COALESCE(valor_venda, valor_locacao)`. Nulos ficam por último.

### Paginação em duas fases

Carregar relações de um-para-muitos junto com `LIMIT` faz o banco contar linhas do JOIN, não imóveis. Por isso
`listar`:

1. conta o total com a consulta base;
2. busca só os ids da página, ordenados, com desempate por `id DESC`;
3. carrega imóveis com corretor, tipo, finalidade e, no interno, proprietário;
4. carrega mídias e características desses ids em duas consultas paralelas e distribui em memória;
5. reordena os itens pela ordem dos ids.

### Escrita

`criar` e `atualizar` rodam em transação. `atualizar` trava o imóvel com `pessimistic_write`. `validar_referencias`
confere, com trava de leitura, que tipo, finalidade, proprietário e corretor existem e estão ativos.
`salvar_caracteristicas` desativa todos os vínculos do imóvel e regrava os enviados como ativos, preservando a
auditoria dos que já existiam. `definidos()` descarta campos `undefined` antes do `Object.assign`.

### Respostas

`resposta_imovel_publico` monta o JSON campo a campo. Do corretor sai só `id`, `nome`, `whatsapp`, `creci`,
`url_foto`. Das mídias, sem `chave_armazenamento`. Características só ativas. `resposta_imovel` acrescenta a ficha
interna. Montar à mão faz com que coluna nova não vaze por acidente.

---

## 9. Mídias

| Arquivo | O que faz |
|---|---|
| `midias.module.ts` | cria o `S3Client` do R2 sob o token `R2_MIDIAS`, com timeouts |
| `midias.controller.ts` | as cinco rotas sob `/admin/imoveis/:imovel_id/midias` |
| `midias.service.ts` | envio, embed, ordem, capa e exclusão, com compensação no R2 |
| `imovel-midia.entity.ts` | mapeia `imoveis_midias` e o enum `TipoMidia` |
| `validacao-arquivo.ts` | tipos aceitos, assinatura de bytes e limites |
| `video-embed.ts` | normaliza URLs do YouTube e do Vimeo |

### Envio

`FilesInterceptor('arquivos', 20, { limits: { fileSize: 30 MB, files: 20, fields: 0 } })` lê o multipart para a
memória depois dos guards. `validar_arquivo` exige que o tamanho declarado bata com o buffer e confere os
**primeiros bytes** de cada formato: JPEG, PNG, WebP, MP4 e WebM. Imagem até 10 MB, vídeo até 30 MB, lote até 60 MB.
A extensão vem do mapa interno, nunca do nome enviado.

Na transação, `bloquear_imovel` trava o imóvel e confere dono ou ADMIN. Cada arquivo vai ao R2 com a chave
`imoveis/<id>/<uuid><extensão>`, anotada numa lista **antes** do envio. A primeira imagem vira capa se não houver
outra. Se qualquer coisa falhar, o `catch` apaga do R2 todas as chaves da lista. Se até a limpeza falhar, registra no
log e responde 503.

### Exclusão

Baixa uma cópia do objeto, apaga no R2, remove a linha, renumera a ordem e promove a próxima imagem a capa se a
removida era a capa. Se o banco falhar depois de apagar no R2, devolve a cópia ao bucket.

### Embeds

`normalizar_video_embed` aceita só HTTPS, sem usuário, senha ou porta, e compara o host por **igualdade exata**.
`youtube.com.site-falso.net` não passa. YouTube vira `youtube-nocookie.com/embed/<id>`; Vimeo vira
`player.vimeo.com/video/<id>`. Embed não tem `chave_armazenamento` e nunca é capa.

### Ordem e capa

`reordenar` exige a lista completa de ids do imóvel, sem repetição. `definir_capa` exige imagem, desmarca a capa atual
e marca a nova na mesma transação. O índice único parcial impede duas capas mesmo sob concorrência.

---

## 10. Pessoas

| Arquivo | O que faz |
|---|---|
| `pessoa.entity.ts` | mapeia `pessoas`, enums e `resposta_pessoa()` sem o IP |
| `pessoas.controller.ts` | `PessoasPublicasController` (`POST /pessoas`) e `PessoasController` (`/admin/pessoas`) |
| `pessoas.service.ts` | contato do site, cadastro manual, listagem, alteração, visibilidade |
| `pessoas.dto.ts` | `PessoaPublicaDto`, `CriarPessoaDto`, `AtualizarPessoaDto`, `ConsultaPessoasDto` |
| `limite-pessoas.guard.ts` | 5 envios por minuto por IP |

**Uma pessoa é uma pessoa.** O contato do site, o cliente, o proprietário e o inquilino são o mesmo cadastro. Não
existe coluna de papel: o papel aparece pelo vínculo (proprietário do imóvel, locador ou locatário do contrato).

### Contato do site

1. `LimitePessoasGuard` limita por IP.
2. `PessoaPublicaDto` exige nome, telefone brasileiro válido, `imovel_id` e `consentimento` exatamente `true`.
3. O service confere o consentimento de novo e exige imóvel ativo, disponível e com corretor ativo.
4. Grava com o corretor do imóvel, `origem = SITE`, `status_contato = PENDENTE`, IP, data e `versao_termos = 'v1.0'`.
5. O CHECK `consentimento_site` é a última barreira no banco.
6. Responde só `{ id }`.

Ninguém é avisado de um contato novo. É a tarefa NOTIFY-001.

### Cadastro manual e alteração

- Nasce com `origem = MANUAL`, `status_contato = RESPONDIDO` por padrão e `consentimento = false`. O sistema não
  finge consentimento.
- `corretor_id` diferente do próprio só para ADMIN.
- `validarDocumento` confere CPF ou CNPJ, deduz `tipo_pessoa` pelo tamanho quando vier só o documento, recusa tipo
  incoerente e exige data de nascimento no passado e só para PF.
- Desativar pessoa com contrato ATIVO como locador ou locatário responde 409.

### Visibilidade

ADMIN vê todas. Corretor vê as pessoas sob sua responsabilidade **e** as que participam de contratos que intermedeia,
por um `EXISTS` no `WHERE`. Para alterar, precisa ser o responsável ou ADMIN. Pessoa invisível responde 404.

A busca procura em nome e e-mail e, se o termo tiver dígitos, também em telefone e documento.

---

## 11. Locações e Google Drive

| Arquivo | O que faz |
|---|---|
| `locacoes/contrato.entity.ts` | mapeia `contrato` e `resposta_contrato()` com nomes do imóvel e das partes |
| `locacoes/locacoes.controller.ts` | as seis rotas de `/admin/contratos` |
| `locacoes/locacoes.service.ts` | validação, criação, alteração, expiração e integração com o Drive |
| `locacoes/locacoes.dto.ts` | DTOs de contrato e de consulta |
| `drive/drive.service.ts` | garante a hierarquia de pastas e o registro em `pastas_drive` |
| `drive/drive-cliente.ts` | cliente HTTP do Google: token OAuth, criação e validação de pastas |
| `drive/registro-pasta-drive.entity.ts` | mapeia `pastas_drive` |

### Regras do contrato

- Toda escrita roda em transação com `pg_advisory_xact_lock(hashtext('locacoes:integridade'))`.
- Antes de qualquer operação, contratos com `data_fim` no passado viram `INATIVO`. Isso também roda por `@Cron` a cada
  hora e antes de cada consulta.
- Corretor comum só cria contrato em que ele é o intermediador e não pode trocar o intermediador.
- `validarContrato` confere datas, valores em centavos, partes distintas e trava imóvel, corretor e pessoas **em ordem
  crescente de id**, para evitar deadlock. Contrato ativo exige tudo ativo.
- Contrato com comissão registrada não pode trocar de imóvel.
- Segundo contrato ATIVO no mesmo imóvel estoura o índice único parcial, e o código `23505` vira 409.

### A pasta no Drive

A pasta é criada **depois** de salvar o contrato, fora da transação.

1. `DriveCliente.validarPastaPrivada` confere que a raiz pertence ao Drive compartilhado configurado e que nenhuma
   permissão é `anyone` ou `domain`.
2. `garantirPasta` cria ou reaproveita, nesta ordem, `Imobiliária`, `Contratos` e `{numero} - {locatário}`. Para cada
   uma, numa transação com advisory lock, registra em `pastas_drive` um **id pedido antes ao Google**
   (`files/generateIds`).
3. Com a transação confirmada, cria a pasta usando esse id. Se a rede falhar e a operação se repetir, o Google
   responde 409 e o código entende que a criação anterior deu certo. A operação é **idempotente**.
4. Mudança de número ou locatário renomeia a mesma pasta.

Sucesso grava `url_pasta_drive` e `CRIADA`. Falha grava `FALHOU`, preserva o contrato e a rota `pasta-drive` tenta de
novo. O update condicional impede que uma tentativa que falhou apague o resultado de outra que deu certo.

O cliente não usa a biblioteca do Google. Assina o JWT RS256 com `node:crypto`, troca por token de acesso, guarda o
token em memória até um minuto antes de expirar e chama a API com `fetch`, timeout de 10 segundos, até três
tentativas com espera crescente para 429 e 5xx, e uma renovação de token em caso de 401. Nenhum erro externo vai para
o log com credenciais.

---

## 12. Comissões

| Arquivo | O que faz |
|---|---|
| `comissao.entity.ts`, `parcela-comissao.entity.ts` | mapeiam `comissoes` e `parcelas_comissao` |
| `comissoes.controller.ts` | as seis rotas de `/admin/comissoes` |
| `comissoes.service.ts` | criação, listagem, alteração, baixa e atrasos |
| `comissoes.dto.ts` | DTOs de criação, alteração, consulta e pagamento |
| `parcelamento.ts` | `distribuirParcelas` e `vencimentoMensal` |

- Receita da imobiliária, com valor informado pelo usuário. O sistema não calcula comissão de corretor, repasse
  mensal nem cobrança.
- Locação exige contrato ativo do mesmo imóvel; venda não pode ter contrato.
- Pessoa e imóvel precisam estar ativos, ter o **mesmo corretor responsável**, e a pessoa não pode estar vinculada a
  outro imóvel.
- Corretor comum só vê e altera comissões em que ele é responsável pelo imóvel e pela pessoa.
- `distribuirParcelas` converte o total para centavos em `BigInt`, divide e dá os centavos que sobram às primeiras
  parcelas: R$ 100,00 em 3 vira 33,34, 33,33 e 33,33.
- `vencimentoMensal` calcula cada vencimento a partir do primeiro, sem acumular ajustes: dia 31 em fevereiro cai no
  último dia do mês, e março volta ao dia 31.
- Parcela com vencimento passado nasce `ATRASADO`. As demais viram `ATRASADO` por `@Cron` e antes de cada consulta.
- Baixa exige `confirmar_pagamento: true` e referência do comprovante com 5 caracteres ou mais. Repetir a mesma baixa
  devolve a parcela sem erro; outro comprovante responde 409. Comissão desativada não aceita baixa.
- Desativar a comissão desativa as parcelas.
- A listagem calcula `valor_pago` e `saldo_pendente` em centavos.

A resposta de comissão devolve a entidade com as parcelas, sem uma função de resposta montada campo a campo, ao
contrário dos outros módulos.

---

## 13. Suporte

### `src/comum/`

- `auditoria.entity.ts`: a classe abstrata herdada por todas as entities.
- `dto.ts`: `IdRegistro()` (junta `@Type(() => Number)`, `@IsInt()` e `@Min(1)` com `applyDecorators`) e os
  transformadores `aparar`, `booleano`, `decimal`, e as condições `definido` e `informado` para `@ValidateIf`.
  `informado` ignora `null`, o que permite limpar um campo opcional mandando `null`.
- `validacao.ts`: dígitos verificadores de CPF e CNPJ, telefone brasileiro, data civil válida, conversão de decimal em
  centavos, os decorators `@DocumentoValido`, `@TelefoneValido`, `@DataCivilValida`, e `escaparBusca`.
- `datas.ts`: `DATA_ATUAL_SQL` e `hojeCivil()` no fuso `America/Cuiaba`.

`escaparBusca` escapa `\`, `%` e `_` antes de um `ILIKE`. Não é contra SQL injection, que a parametrização já evita: é
para que uma busca por `%` não case com tudo.

### `src/common/filters/global-exception.filter.ts`

`@Catch()` sem argumento captura tudo. Erros de status 500 ou mais vão ao log só com o código do PostgreSQL, sem SQL
nem parâmetros. A resposta é `{ statusCode, message }`, com `message` em texto ou lista, como o front espera.

### `src/database/log-seguro.ts`

`LoggerSeguro` implementa a interface de logger do TypeORM sem registrar nada: SQL com parâmetros pode conter CPF,
telefone e e-mail. `mensagemFalhaOperacional` produz a mensagem genérica usada pelo filtro e pelos comandos.

### `src/commands/migracoes.ts`

É o executor de `npm run migration:show`, `migration:run` e `migration:revert`, no lugar da CLI do TypeORM, que
imprime erros com parâmetros. Para executar ou reverter, exige `MIGRACAO_BACKUP_ARQUIVO` apontando para um arquivo não
vazio. Roda todas as migrations pendentes numa única transação e imprime só a contagem. Só mensagens controladas pelo
código chegam ao terminal.

### `src/commands/bootstrap-admin.ts`

Valida as `BOOTSTRAP_ADMIN_*` com o `CriarCorretorDto` **antes** de conectar e reporta só nomes de variável. Sobe o
Nest com `createApplicationContext`, sem servidor HTTP, e chama `criarAdministradorInicial`, que recusa se já houver
ADMIN. Imprime só o id criado.

### `src/saude/`

`GET /saude` executa `SELECT 1`. Responde `{ status: 'ok', verificado_em }` ou 503, sem dado de negócio.

---

## 14. Como o projeto se testa

Jest com `ts-jest`, arquivos `*.spec.ts` ao lado do código, execução em série. 27 arquivos de teste.

### Quatro tipos de teste

1. **Unitários de service com mocks** (`pessoas.service.spec.ts`, `comissoes.service.spec.ts` e outros). O
   repositório é um objeto com `jest.fn()`. O teste confere as condições que o service mandou ao QueryBuilder e o
   objeto que ele tentou gravar.
2. **HTTP com aplicação Nest real** (`autenticacao.http.spec.ts`, `cadastros.http.spec.ts`). Sobem o módulo numa porta
   aleatória e trocam só os repositórios:
   ```ts
   Test.createTestingModule({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true, skipProcessEnv: true, load: [...] }), AutenticacaoModule] })
     .overrideProvider(getRepositoryToken(Corretor)).useValue(repositorio)
   ```
   Rotas, guards, pipes e regras são reais. O `ConfigModule` ignora o `.env` da máquina.
3. **Processo real** (`bootstrap.spec.ts`). Executa `main.ts` e o bootstrap num subprocesso e prova que o processo sai
   com código 1 **antes** de conectar e **sem** imprimir valores de segredo.
4. **Integração com PostgreSQL real** (`database/modelo-portugues.integracao.spec.ts`). Roda as migrations com dados
   sintéticos, confere constraints e percorre o fluxo HTTP inteiro. Só executa com `TESTE_LOCAL_DATABASE_URL` ou
   `HOMOLOGACAO_DATABASE_URL`.

### Detalhes

- `jest.config.cjs` troca `@nestjs/schedule` por `src/testing/schedule.mock.ts`, para os `@Cron` não dispararem.
- A configuração do `ValidationPipe` está repetida no `main.ts` e nos testes HTTP. Mudar uma sem a outra deixa a suíte
  verde validando outra coisa.
- `bootstrap.spec.ts` tem limite de 15 segundos por subprocesso. Em 17/09/2026, nesta máquina com a pasta no OneDrive,
  um dos casos estourou o tempo: 174 testes passaram, 4 foram ignorados e 1 falhou por tempo.

### O que não tem teste automatizado

Upload real no R2, criação real de pastas no Drive e a cadeia completa das 10 migrations sobre banco vazio.

---

## 15. Travessia: o ciclo de uma requisição

### A ordem de execução

```text
1. middleware do Express  (helmet, reescrita de URL, CORS, leitura do corpo)
2. guards                 (autenticação, cargo, origem, limites)
3. interceptors, antes    (upload de arquivos)
4. pipes                  (ValidationPipe, ParseIntPipe)
5. handler do controller  → service → banco, R2, Drive
6. interceptors, depois
7. serialização e envio
   erro em qualquer etapa → GlobalExceptionFilter
```

**Guard roda antes de pipe.** `POST /admin/imoveis` sem token e com corpo inválido responde 401, nunca 400.
Guards veem o corpo já lido, mas não o DTO validado.

### `GET /imoveis`

Sem guard. `ValidationPipe` monta o `ConsultaImoveisDto` com padrões `pagina = 1` e `limite = 20` (máximo 100) e
converte os textos da query. O service escolhe a coluna de preço, aplica a restrição pública, conta, busca os ids da
página e carrega os dados. `resposta_imovel_publico` decide o que sai. 200.

### `POST /admin/imoveis`

Preflight CORS, corpo lido, `AutenticacaoGuard`, `EstrategiaJwt` relê o corretor, `request.user` preenchido,
`ValidationPipe`, handler, service: valida áreas, abre transação, valida referências, pede o próximo id, monta o slug,
`create` instancia em memória e `save` faz o INSERT, grava características. Recarrega a ficha completa. 201.

### Quem rejeita o quê

| Etapa | Status |
|---|---|
| validação do ambiente, no boot | processo sai com código 1 |
| `OrigemGuard` | 403 |
| `TentativasGuard`, `LimitePessoasGuard` | 429 |
| `AutenticacaoGuard` e `EstrategiaJwt` | 401 |
| `CargosGuard` | 403 |
| `ValidationPipe`, `ParseIntPipe` | 400 |
| service: sem permissão sobre registro visível | 403 |
| service: não encontrado ou invisível | 404 |
| service ou banco: unicidade, último ADMIN, contrato ativo | 409 |
| banco fora, Drive falhou, compensação falhou | 503 |
| erro não tratado | 500 genérico |

---

## 16. Travessia: o que acontece quando você apaga

### Pela API, quase nada é apagado

| Rota `DELETE` | Efeito |
|---|---|
| corretor | `ativo = false`; protegido pela regra do último ADMIN |
| tipo, finalidade, característica | `ativo = false` |
| imóvel | `ativo = false`; mídias, características e contratos continuam |
| pessoa | `ativo = false`; recusado com contrato ATIVO |
| contrato | `ativo = false` e, pela validação, `status = INATIVO` |
| comissão | `ativo = false` na comissão e nas parcelas |
| mídia | **exclusão física** no R2 e no banco |
| sessão (`sair`, troca de senha, limpeza horária) | **exclusão física** |

Reativar é `PATCH { "ativo": true }`.

### O que as chaves estrangeiras fariam num `DELETE` direto no banco

- `RESTRICT` em quase tudo: corretor com imóveis, pessoas ou auditoria; imóvel com contrato ou comissão; pessoa com
  contrato, comissão ou como proprietária.
- `CASCADE`: mídias e características do imóvel, parcelas da comissão, sessões do corretor.
- `SET NULL`: o imóvel de interesse da pessoa. O contato sobrevive se o imóvel sumir.

A história que o schema conta: **histórico de negócio não se perde; o que é descartável vai junto com o dono.**

### Onde o banco não protege

1. **O R2 não tem chave estrangeira.** Um `DELETE` direto de imóvel no banco apagaria as linhas de mídia por CASCADE e
   deixaria os arquivos órfãos no bucket. A API nunca faz isso, porque o `DELETE` de imóvel é lógico.
2. **"Pelo menos um ADMIN ativo"** só existe no código, com o advisory lock.
3. **Pessoa e imóvel com o mesmo corretor numa comissão** só existe no código.
4. **Status `ATRASADO` e contratos vencidos** dependem do `@Cron` e das consultas; o banco não muda o status sozinho.
5. **Limites de tentativa** vivem na memória do processo.

---

## 17. Travessia: a corrente de segurança

| Camada | Onde | Contra o quê |
|---|---|---|
| 0 | `env.validation.ts` | segredo curto, banco adulterado, TLS desligado, segredo impresso |
| 1 | `database.config.ts` | interceptação da conexão com o Neon |
| 2 | `helmet()` | clickjacking, *MIME sniffing*, ausência de HSTS |
| 3 | `ValidationPipe` com whitelist | *mass assignment* de `cargo`, `ativo`, `senha_hash` |
| 4 | Argon2id, `select: false` | vazamento de senha, mesmo com o banco exposto |
| 5 | hash de disfarce no login | enumeração de contas pelo tempo |
| 6 | par de tokens e cookie HttpOnly | XSS roubando sessão longa |
| 7 | `SameSite=Strict` e `OrigemGuard` | CSRF, com defesa no navegador e no servidor |
| 8 | `TentativasGuard`, `LimitePessoasGuard` | força bruta, *password spraying*, spam de contatos |
| 9 | `EstrategiaJwt` relendo o banco | JWT irrevogável |
| 10 | `CargosGuard` | rota por cargo |
| 11 | filtro no `WHERE`, checagem de dono | IDOR, sem oráculo de existência |
| 12 | funções `resposta_*` e `perfilCorretor` | vazamento de chave do R2, IP, hash, campos internos |
| 13 | assinatura de bytes, host exato, chave gerada pelo servidor | arquivo disfarçado, host enganoso, *path traversal* |
| 14 | `GlobalExceptionFilter`, `LoggerSeguro` | vazamento de SQL, stack trace, dado pessoal |
| 15 | pasta do Drive sem permissão pública | documentos de contrato expostos |

Cada camada é falível sozinha, e por isso existe a seguinte. `SameSite` depende do navegador, então há o guard de
origem. O JWT não é revogável, então a estratégia relê o banco. O DTO pode ter um erro, então o banco tem CHECKs.

### Fragilidades conhecidas

- **Limites em memória de instância única.** Duas instâncias dobram o limite; reinício zera.
- **O teto de 10.000 chaves do `TentativasGuard` tranca o login de todos.** Um atacante que encha o mapa com e-mails
  aleatórios faz toda tentativa levar 429 por até 15 minutos.
- **O padrão é aberto.** Não existe guard global; rota nova sem `@UseGuards` é pública.
- **Não há detecção de reuso de token de renovação.** Um token roubado e já consumido leva 401, mas as outras sessões
  não são revogadas.
- **Redefinição de senha pelo ADMIN não revoga as sessões** do corretor alvo.
- **O cookie é sempre `Secure`**: o navegador em HTTP puro não guarda a sessão.

---

## 18. Receitas

### Rodar o projeto

```bash
npm ci
cp .env.example .env        # preencha; o .env de desenvolvimento existe só na máquina do dono
npm run start:dev           # porta 3000
```

Banco novo: `npm run migration:run` com `MIGRACAO_BACKUP_ARQUIVO` e depois `npm run bootstrap:admin`. Remova as
`BOOTSTRAP_ADMIN_*` do `.env` depois.

### Antes de commitar

```bash
npm run typecheck && npm run lint && npm test
```

### Adicionar um campo ao imóvel

1. **Migration nova** em `src/database/migrations/`, registrada em `src/database/registros.ts`. Nunca edite uma aplicada.
2. **A entity** `imovel.entity.ts`. Coluna `numeric` é tipada como `string`.
3. **`CriarImovelDto`.** O `AtualizarImovelDto` herda por `PartialType`. Sem isso, quem mandar o campo leva 400.
4. **A resposta**: `resposta_imovel_publico` se o site pode ver, ou só `resposta_imovel` se for interno.
5. Se virar filtro: `ConsultaImoveisDto` ou `ConsultaInternaImoveisDto` e uma condição em `listar`.
6. Testes do DTO e do service.

### Adicionar uma entidade

Entity herdando de `Auditoria`; `TypeOrmModule.forFeature([...])` no módulo; inclusão na lista `entidades` de
`registros.ts`, senão o CLI de migrations não a enxerga; migration nova.

### Adicionar um endpoint

- Declare `@UseGuards(AutenticacaoGuard)`, e `CargosGuard` com `@Cargos('ADMIN')` se for só de ADMIN. O padrão é público.
- Ids na URL com `ParseIntPipe`.
- Passe `requisicao.user` ao service e filtre pelo dono no `WHERE`.
- Rota pública de imóvel replica `ativo = true`, `status = DISPONIVEL` e corretor ativo.
- Monte a resposta com uma função `resposta_*`, nunca devolvendo a entity crua.
- Rota que depende do cookie leva `OrigemGuard`.

### Adicionar uma variável de ambiente

Declare em `EnvironmentVariables` com decorators, acrescente ao `.env.example` com comentário e registre em
`DECISIONS.md`, como exige o `AGENTS.md`.

### Quem pode o quê

| Ação | CORRETOR | ADMIN |
|---|---|---|
| ver o catálogo público | sim | sim |
| ler imóveis internos | todos | todos |
| criar, alterar e desativar imóvel | só os seus | qualquer um |
| atribuir imóvel a outro corretor | não | sim |
| enviar e apagar mídia | só nos seus imóveis | qualquer um |
| ver pessoas | as que atende e as dos seus contratos | todas |
| alterar pessoas | as que atende | todas |
| contratos | os que intermedeia | todos |
| comissões | com imóvel e pessoa seus | todas |
| gerenciar tipos, finalidades e características | não | sim |
| gerenciar corretores | não | sim |

---

## Onde continuar

- **O código**, fonte de verdade.
- [GUIA-DE-ESTUDO.md](GUIA-DE-ESTUDO.md), com plano de estudo e exercícios.
- [DECISIONS.md](../DECISIONS.md), com o porquê de cada escolha e o que não fazer.
- [AGENTS.md](../AGENTS.md), com o protocolo de trabalho.
- [docs/handoffs/2026-09-16-ids-inteiros-pessoas.md](handoffs/2026-09-16-ids-inteiros-pessoas.md), o contrato v2.
