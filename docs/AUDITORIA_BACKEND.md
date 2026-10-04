# 🔍 AUDITORIA COMPLETA DE BACKEND — Corretor-API

**Data**: 2026-09-11  
**Auditor**: Engenheiro Backend Sênior (Antigravity)  
**Escopo**: Todo o backend NestJS — `src/` (auth, agents, properties, leads, media, config, database, commands)  
**Stack**: NestJS 11 + TypeORM + PostgreSQL (Neon) + Cloudflare R2 + Argon2 + Passport-JWT

---

## 📋 ÍNDICE

1. [Segurança](#1-segurança)
2. [Banco de Dados](#2-banco-de-dados)
3. [Arquitetura e Qualidade de Código](#3-arquitetura-e-qualidade-de-código)
4. [Performance e Escalabilidade](#4-performance-e-escalabilidade)
5. [Operação e Confiabilidade](#5-operação-e-confiabilidade)
6. [Tabela Resumo](#tabela-resumo)
7. [Top 5 Quick Wins](#top-5-quick-wins)
8. [Nota Final](#nota-final)

---

## 1. Segurança

### SEC-01 🟡 Médio — Sem validação de tamanho no parâmetro `slug` (rota pública)

**Local**: `src/properties/properties.controller.ts` L19-20

```typescript
@Get(':slug')
detail(@Param('slug') slug: string) { return this.properties.findPublic(slug); }
```

**Problema**: O parâmetro `:slug` é um `string` sem nenhuma validação de formato ou comprimento. Diferente dos outros parâmetros de rota que usam `ParseUUIDPipe`, o slug aceita qualquer string — incluindo payloads enormes ou com caracteres especiais. O TypeORM escapa o valor via query parametrizada (não há SQL injection), mas o parâmetro pode ter milhares de caracteres.

**Impacto**: Um atacante poderia enviar slugs gigantes (ex.: 100 KB) repetidamente, forçando o banco a fazer comparações de texto desnecessariamente caras. Não é crítico porque o TypeORM parametriza, mas é uma superfície de ataque para slowloris/DoS leve.

**Correção**:
```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[a-z0-9-]{1,120}$/.test(value)) {
      throw new BadRequestException('Slug inválido.');
    }
    return value;
  }
}

// No controller:
@Get(':slug')
detail(@Param('slug', ParseSlugPipe) slug: string) {
  return this.properties.findPublic(slug);
}
```

---

### SEC-02 🟡 Médio — Rate limiting em memória não funciona com múltiplas instâncias

**Local**: `src/auth/login-rate.guard.ts` L7

```typescript
private readonly attempts = new Map<string, { count: number; resetAt: number }>();
```

**Problema**: O rate limiter armazena contadores em um `Map` local à instância do processo. Em deploy com N réplicas (ou em Cloudflare Workers, ou com PM2 cluster), cada instância tem seu próprio Map — efetivamente multiplicando o limite por N. Um atacante pode brute-force 10 senhas x N instâncias antes de ser bloqueado.

**Impacto**: Em produção com 3 réplicas, o limite de 10 tentativas por conta vira 30. Um atacante com automação pode testar senhas comuns de forma efetiva. Para single-instance, funciona. Mas escalar horizontalmente anula a proteção.

**Correção**:
```typescript
// Usar Redis ou uma tabela do Postgres para armazenar contadores de rate limit.
// Alternativa simples: usar o pacote @nestjs/throttler com storage Redis.

import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

// No AppModule:
ThrottlerModule.forRoot({
  throttlers: [{ ttl: 900_000, limit: 10 }],
  storage: new ThrottlerStorageRedisService('redis://...'),
})
```

---

### SEC-03 🟡 Médio — Rota `POST /leads` pública sem rate limiting

**Local**: `src/leads/leads.controller.ts` L15-18

```typescript
@Post()
create(@Body() dto: CreateLeadDto, @Req() request: Request) {
  return this.leads.create(dto, request.ip ?? 'unknown');
}
```

**Problema**: O endpoint de criação de leads é totalmente público (sem autenticação, sem guard de rate limit, sem `BrowserOriginGuard`). Qualquer IP pode criar leads infinitamente.

**Impacto**: Um bot pode inundar o banco de dados com milhões de leads falsos, causando:
- Spam nos dados do corretor
- Crescimento descontrolado do banco (custo no Neon)
- Dificuldade para o corretor identificar leads reais
- Possível DoS por volume de escritas

**Correção**:
```typescript
@Post()
@UseGuards(BrowserOriginGuard, LeadRateGuard) // Criar um guard similar ao LoginRateGuard
create(@Body() dto: CreateLeadDto, @Req() request: Request) {
  return this.leads.create(dto, request.ip ?? 'unknown');
}

// Limitar por IP a, por exemplo, 30 leads por hora
```

---

### SEC-04 🟡 Médio — Sem headers de segurança HTTP (Helmet ausente)

**Local**: `src/main.ts` (ausência)

**Problema**: Nenhum middleware de headers de segurança está configurado. Ausentes:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `X-XSS-Protection` (legado, mas útil)

O `package.json` não contém `helmet` como dependência.

**Impacto**: O servidor retorna respostas sem proteção contra clickjacking, MIME sniffing e outros ataques de browser. Em produção com HTTPS, a ausência de HSTS permite downgrade attacks.

**Correção**:
```bash
npm install helmet
```
```typescript
// src/main.ts
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule);
  application.use(helmet());
  // ... resto da configuração
}
```

---

### SEC-05 🔵 Baixo — Campo `features` aceita JSON arbitrário sem limite de profundidade/tamanho

**Local**: `src/properties/dto/create-property.dto.ts` L72-74

```typescript
@ValidateIf((_object, value: unknown) => value !== undefined)
@IsObject()
features?: Record<string, unknown>;
```

**Problema**: O campo `features` aceita qualquer objeto JSON sem validação de profundidade, número de chaves ou tamanho total. O `@IsObject()` verifica apenas se é um objeto, não seu conteúdo.

**Impacto**: Um atacante pode enviar um JSON extremamente profundo ou grande (ex.: 10 MB de JSON com milhões de chaves aninhadas), causando parsing lento e consumo de memória. O `express.json()` padrão limita a aprox. 100 KB, o que mitiga parcialmente, mas ainda permite payloads maliciosos dentro do limite.

**Correção**:
```typescript
@ValidateIf((_object, value: unknown) => value !== undefined)
@IsObject()
@Transform(({ value }: { value: unknown }) => {
  if (typeof value === 'object' && value !== null && JSON.stringify(value).length > 10_000) {
    throw new BadRequestException('features excede o tamanho máximo.');
  }
  return value;
})
features?: Record<string, unknown>;
```

---

### SEC-06 🔵 Baixo — Dados PII de leads (telefone, email, nome) armazenados em texto puro

**Local**: `src/leads/lead.entity.ts` L27-34

```typescript
@Column({ name: 'lead_name', type: 'text' })
leadName!: string;

@Column({ name: 'lead_phone', type: 'text' })
leadPhone!: string;

@Column({ name: 'lead_email', type: 'text', nullable: true })
leadEmail!: string | null;
```

**Problema**: As regras do projeto exigem que dados sensíveis (CPF, telefone, email) sejam criptografados com AES-256-GCM. Os dados de leads contêm nome, telefone e email de pessoas de fora do sistema, armazenados em texto puro no banco.

**Impacto**: Em caso de vazamento do banco de dados (ex.: credenciais comprometidas do Neon), todos os dados pessoais dos leads ficam expostos sem proteção adicional. Viola as próprias diretrizes LGPD definidas para o projeto.

**Correção**: Implementar criptografia AES-256-GCM nos campos `leadName`, `leadPhone` e `leadEmail` usando um `ValueTransformer` do TypeORM com chave derivada de uma variável de ambiente dedicada.

---

### ✅ Segurança — O que está BEM feito

- **Hashing de senhas**: Argon2id — estado da arte, melhor que bcrypt. (`password.service.ts`)
- **JWT bem configurado**: Algoritmo explícito HS256, issuer, audience, expiração obrigatória, `ignoreExpiration: false`. (`auth.module.ts`, `jwt.strategy.ts`)
- **Refresh tokens seguros**: Token de 384 bits (`randomBytes(48)`), armazenado como hash SHA-256, consumo atômico via `DELETE RETURNING` (impede reuso em requests concorrentes). (`session.service.ts`)
- **Cookie httpOnly + Secure + SameSite=Strict**: O refresh token é transportado com as três flags corretas. (`auth.controller.ts` L44-46)
- **ValidationPipe global com `whitelist` + `forbidNonWhitelisted`**: Rejeita campos não declarados nos DTOs. (`main.ts` L13-17)
- **DTOs rigorosos**: Todos os endpoints têm validação explícita de input com `class-validator`. Strings são trimadas, emails normalizados, enums validados, UUIDs parseados.
- **Validação de variáveis de ambiente na inicialização**: A aplicação falha rápido se qualquer variável estiver ausente ou inválida. (`env.validation.ts`)
- **Sem secrets no código**: Nenhum `.env` commitado, `.gitignore` correto, nenhuma chave hardcoded em nenhum arquivo.
- **CORS configurável por variável de ambiente**: Origens exatas, sem wildcard. (`browser-origin.guard.ts`)
- **BrowserOriginGuard**: Proteção extra contra CSRF verificando `Origin` e `Sec-Fetch-Site`. (`browser-origin.guard.ts`)
- **Autorização IDOR**: `findOwned()` e `ownerRestriction()` filtram por `agentId` do viewer para agents não-admin. (`properties.service.ts`, `leads.service.ts`, `media.service.ts`)
- **SSL obrigatório**: `rejectUnauthorized: true` na conexão com o Postgres. (`database.config.ts` L23)

---

## 2. Banco de Dados

### DB-01 🟡 Médio — Sessões expiradas nunca são limpas automaticamente

**Local**: `src/auth/session.service.ts` e `src/auth/refresh-session.entity.ts`

```typescript
// session.service.ts L26
if (!consumed || new Date(consumed.expires_at).getTime() <= Date.now()) {
  throw new UnauthorizedException('Sessão expirada. Entre novamente.');
}
```

**Problema**: Sessões expiradas permanecem na tabela `refresh_sessions` indefinidamente. A coluna `expires_at` é verificada apenas no momento do consumo (`consume()`). Se um usuário nunca faz refresh, a linha permanece no banco para sempre. Não há cron job, scheduled task ou TTL configurado.

**Impacto**: A tabela `refresh_sessions` cresce indefinidamente. Com milhares de logins por mês, em um ano pode acumular centenas de milhares de registros inúteis. No Neon (com billing por storage), isso gera custo desnecessário. A index `idx_refresh_sessions_expiry` existe justamente para facilitar cleanup, mas ninguém a usa.

**Correção**:
```typescript
// Adicionar um método de cleanup e chamá-lo periodicamente
// (via @nestjs/schedule ou um cron externo)

async purgeExpired(): Promise<number> {
  const result = await this.sessions
    .createQueryBuilder()
    .delete()
    .where('expires_at <= :now', { now: new Date() })
    .execute();
  return result.affected ?? 0;
}
```
```sql
-- Ou rodar via cron no banco:
DELETE FROM refresh_sessions WHERE expires_at <= now();
```

---

### DB-02 🟡 Médio — Índice ausente na coluna `address_city` de `properties`

**Local**: `src/properties/property.entity.ts` e `src/database/migrations/1789084801000-create-properties.ts`

**Problema**: A rota pública `GET /properties` filtra por cidade usando `ILike`:
```typescript
// properties.service.ts L77
if (query.city) where.addressCity = ILike(query.city.trim().replace(/[\\%_]/g, '\\$&'));
```
Mas não existe índice na coluna `address_city`. Os índices existentes são `IDX_properties_agent_id` e `IDX_properties_public_created` (status + created_at).

**Impacto**: Consultas filtradas por cidade fazem sequential scan na tabela inteira. Com 10.000+ imóveis, isso se torna lento. Combinado com `ILike` (case-insensitive), o Postgres não pode usar índice B-tree simples.

**Correção**:
```sql
-- Criar índice trigram para buscas ILike performáticas:
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IDX_properties_city_trgm ON properties USING gin (address_city gin_trgm_ops);

-- OU, se ILike é sempre match exato (sem wildcard no meio), um btree com lower():
CREATE INDEX IDX_properties_city_lower ON properties (lower(address_city));
```

---

### DB-03 🟡 Médio — `setCover` e `reorder` sem transação — inconsistência possível

**Local**: `src/media/media.service.ts` L87-95

```typescript
async setCover(propertyId: string, mediaId: string, viewer: AgentProfile): Promise<PropertyMedia> {
  const property = await this.findOwnedProperty(propertyId, viewer);
  const selected = await this.findMedia(property.id, mediaId);
  const existing = await this.listForProperty(property.id);
  for (const item of existing) item.isCover = item.id === selected.id;
  await this.media.save(existing);       // <-- Múltiplos UPDATEs sem transação explícita
  selected.isCover = true;
  return selected;
}
```

**Problema**: `setCover` faz múltiplos UPDATEs (um por mídia) fora de uma transação explícita. Se o processo morrer entre UPDATEs, é possível ter 0 ou 2+ covers simultaneamente. O mesmo ocorre em `reorder` (L73-84).

**Impacto**: Em produção, se o servidor receber um sinal de encerramento durante o save, as mídias de um imóvel podem ficar com dados inconsistentes (duas mídias marcadas como cover, ou nenhuma). O frontend pode exibir comportamento inesperado.

**Correção**:
```typescript
async setCover(propertyId: string, mediaId: string, viewer: AgentProfile): Promise<PropertyMedia> {
  const property = await this.findOwnedProperty(propertyId, viewer);
  return this.media.manager.transaction(async (manager) => {
    const repository = manager.getRepository(PropertyMedia);
    const selected = await repository.findOne({ where: { id: mediaId, propertyId: property.id } });
    if (!selected) throw new NotFoundException('Mídia não encontrada.');
    await repository.update({ propertyId: property.id }, { isCover: false });
    selected.isCover = true;
    return repository.save(selected);
  });
}
```

---

### DB-04 🔵 Baixo — `upload()` faz uploads sequenciais ao S3 dentro de um loop

**Local**: `src/media/media.service.ts` L44-55

```typescript
for (const [offset, file] of files.entries()) {
  const { type, extension } = this.validateFile(file);
  const storageKey = `properties/${property.id}/${randomUUID()}${extension}`;
  await this.storage.send(new PutObjectCommand({...}));   // <-- Sequencial
  uploadedKeys.push(storageKey);
  // ...
}
```

**Problema**: Cada arquivo é enviado ao R2 sequencialmente. Com 20 arquivos de 5 MB cada, o request fica bloqueado por minutos. O loop é sequencial por design (para rollback de uploads parciais), mas o `save()` no banco também não está em transação.

**Impacto**: Uploads múltiplos são lentos. Se o upload do arquivo 15/20 falha, os 14 anteriores são limpos no R2, mas o request inteiro falha — UX ruim. Não é um problema de banco per se, mas de atomicidade operacional.

**Correção**: Ver Performance (PERF-01) para upload paralelo.

---

### ✅ Banco de Dados — O que está BEM feito

- **Migrações manuais em SQL**: Não usa `synchronize: true` em produção. Migrações são DDL explícito com `up/down`. (`database.config.ts` L24, migrations/)
- **Integridade referencial**: FK com `ON DELETE RESTRICT` (agents -> properties), `ON DELETE CASCADE` (properties -> media), `ON DELETE SET NULL` (properties -> leads). Regras corretas para o domínio.
- **CHECK constraints no banco**: `CHK_properties_areas`, `CHK_properties_prices`, `CHK_agents_email_normalized` — validação duplicada no banco que protege contra bugs na aplicação.
- **Índices compostos adequados**: `IDX_leads_agent_created`, `IDX_leads_property_created`, `IDX_properties_public_created` — cobrem as queries mais usadas.
- **Paginação obrigatória**: Todos os endpoints de listagem usam `skip/take` com `Max(100)` no limit.
- **Transação explícita com advisory lock**: `agents.service.ts` L37-39 protege contra race condition ao rebaixar/desativar o último admin.
- **SSL obrigatório e connection timeout**: `rejectUnauthorized: true` + `connectionTimeoutMillis: 10_000`.

---

## 3. Arquitetura e Qualidade de Código

### ARQ-01 🟡 Médio — Nenhum exception filter global — stack traces podem vazar em produção

**Local**: `src/main.ts` (ausência) + `src/common/filters/.gitkeep`

**Problema**: O diretório `src/common/filters/` existe mas está vazio (apenas `.gitkeep`). Não há nenhum `ExceptionFilter` global registrado. O NestJS, por padrão, retorna stack traces em respostas de erro quando `NODE_ENV !== 'production'` — mas se o NODE_ENV não estiver corretamente definido no ambiente de produção, ou se uma exceção inesperada do TypeORM/Postgres vazar, o erro padrão do NestJS pode incluir informações internas como nome de tabela, query SQL ou caminho de arquivo.

**Impacto**: Em produção, erros inesperados (ex.: violação de constraint não tratada, timeout de banco) podem expor detalhes internos ao atacante: nomes de tabelas, estrutura de queries, paths do servidor.

**Correção**:
```typescript
// src/common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      message: exception instanceof HttpException
        ? exception.getResponse()
        : 'Erro interno do servidor.',
    });
  }
}

// main.ts:
application.useGlobalFilters(new GlobalExceptionFilter());
```

---

### ARQ-02 🔵 Baixo — Sem logging estruturado em toda a aplicação

**Local**: Todo o `src/` — nenhuma referência a `Logger` do NestJS (exceto nos testes)

**Problema**: O backend inteiro não tem uma única instrução de log. Nenhum `Logger` do NestJS é instanciado em nenhum service ou controller. Erros em `media.service.ts` (falha no upload R2), em `session.service.ts` (expiração/consumo), em `agents.service.ts` (conflitos de constraint) — todos re-lançam exceções sem logar nada antes.

**Impacto**: Em produção, sem logs:
- Impossível debugar falhas intermitentes
- Impossível fazer auditoria de acessos (quem fez login quando)
- Impossível detectar tentativas de brute-force ou abuso
- Impossível gerar métricas de operação

**Correção**:
```typescript
// Em cada service, adicionar:
private readonly logger = new Logger(AuthService.name);

// E logar eventos relevantes:
this.logger.warn(`Login falhou para ${dto.email}`);
this.logger.log(`Lead criado para imóvel ${property.id}`);
this.logger.error(`Upload R2 falhou para key ${storageKey}`, error);
```

---

### ARQ-03 🔵 Baixo — `create()` de Agent tem race condition (check-then-act)

**Local**: `src/agents/agents.service.ts` L60-63

```typescript
async create(dto: CreateAgentDto): Promise<AgentProfile> {
  if (await this.agents.existsBy({ email: dto.email })) {       // <-- Read
    throw new ConflictException('Já existe um corretor com esse e-mail.');
  }
  const agent = this.agents.create({...});
  // ... await this.agents.save(agent);                          // <-- Write
```

**Problema**: Existe um intervalo entre o `existsBy` (leitura) e o `save` (escrita) onde outra requisição concorrente pode inserir o mesmo email. O código reconhece isso no catch abaixo (L77-82 trata o constraint 23505), então o banco protege via UNIQUE.

**Impacto**: Na prática, sem impacto real — o catch no L77-82 trata corretamente a race condition via constraint do banco. O `existsBy` é apenas um "fast path" para UX (evita hash da senha se o email já existe). Mas o padrão check-then-act é um antipattern que pode confundir futuros desenvolvedores.

**Correção**: Código já funciona corretamente graças ao `catch`. Documentar a intenção com um comentário:
```typescript
// Verificação otimista: a constraint UNIQUE protege contra concorrência.
if (await this.agents.existsBy({ email: dto.email })) { ... }
```

---

### ✅ Arquitetura — O que está BEM feito

- **Separação de camadas clara**: Controllers delegam para Services. Nenhuma regra de negócio em controllers. DTOs separados em pastas próprias.
- **Módulos NestJS bem definidos**: Cada feature é um módulo independente com imports/exports explícitos.
- **Funções curtas e focadas**: Nenhuma função excede 30 linhas. `media.service.ts` é o mais complexo com 160 linhas total, mas cada método é conciso.
- **Tipagem forte**: Zero uso de `any` em toda a codebase. Types e interfaces explícitos.
- **Response DTOs**: `toAgentProfile()`, `toPropertyResponse()`, `toLeadResponse()` — funções de mapeamento explícitas que controlam exatamente o que é exposto na API. `passwordHash` é explicitamente excluído.
- **DTOs com `PartialType`**: Reutilização correta de DTOs para update.
- **ILike com escape**: `properties.service.ts` L77 e `leads.service.ts` L85-86 escapam `%`, `_` e `\` corretamente para evitar wildcards maliciosos.
- **Validação Zod-like robusta**: `env.validation.ts` valida tudo e NeonDatabaseUrl é um validador customizado que verifica protocolo, hostname `.neon.tech`, presença de credenciais e SSL.

---

## 4. Performance e Escalabilidade

### PERF-01 🟡 Médio — Upload de arquivos carrega tudo em memória (buffer completo)

**Local**: `src/media/media.service.ts` L25, L47-49

```typescript
type UploadFile = { buffer: Buffer; mimetype: string; size: number };
// ...
await this.storage.send(new PutObjectCommand({
  Bucket: 'corretor-midia', Key: storageKey, Body: file.buffer, ContentType: file.mimetype,
}));
```

**Problema**: O Multer está configurado com storage em memória (padrão). Com 20 arquivos de até 30 MB cada (configurado em `media.controller.ts` L19: `fileSize: 30 * 1024 * 1024`), a request pode consumir até **600 MB de RAM**. Cada upload mantém o buffer inteiro na memória do processo Node.js.

**Impacto**: Com 5 uploads simultâneos de 20 vídeos cada = 3 GB de RAM. Em serverless ou containers com memória limitada, isso causa OOM kill. Mesmo em VMs, pode degradar o serviço para todos os usuários.

**Correção**:
```typescript
// Usar disk storage do Multer e stream para S3:
import { diskStorage } from 'multer';
import { createReadStream } from 'node:fs';
import { Upload } from '@aws-sdk/lib-storage';

// No interceptor:
@UseInterceptors(FilesInterceptor('files', 20, {
  storage: diskStorage({ destination: '/tmp/uploads' }),
  limits: { fileSize: 30 * 1024 * 1024 },
}))

// No service:
const stream = createReadStream(file.path);
const upload = new Upload({
  client: this.storage,
  params: { Bucket: 'corretor-midia', Key: storageKey, Body: stream, ContentType: file.mimetype },
});
await upload.done();
// Limpar o arquivo temporário após upload
```

---

### PERF-02 🔵 Baixo — Uploads sequenciais ao S3 em loop

**Local**: `src/media/media.service.ts` L44-55

```typescript
for (const [offset, file] of files.entries()) {
  // ... validação
  await this.storage.send(new PutObjectCommand({...}));  // <-- await sequencial
}
```

**Problema**: 20 arquivos são enviados um a um ao R2. A latência total é a soma de todas as latências individuais (se cada upload demora 2s, 20 arquivos = 40s).

**Impacto**: Requests de upload demorados. Em produção, o timeout pode matar a request antes de finalizar. UX ruim para o corretor fazendo upload de muitas fotos.

**Correção**:
```typescript
// Upload paralelo com Promise.allSettled e rollback parcial:
const results = await Promise.allSettled(
  files.map(async (file, offset) => {
    const { type, extension } = this.validateFile(file);
    const storageKey = `properties/${property.id}/${randomUUID()}${extension}`;
    await this.storage.send(new PutObjectCommand({...}));
    return { storageKey, type, offset };
  })
);
const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failed = results.filter(r => r.status === 'rejected');
if (failed.length) {
  await Promise.all(successful.map(s => this.deleteFromStorage(s.storageKey)));
  throw new BadRequestException(`${failed.length} arquivo(s) falharam no upload.`);
}
```

---

### PERF-03 🔵 Baixo — Listagem de properties carrega relação `media` + `agent` em todas as listagens

**Local**: `src/properties/properties.service.ts` L82

```typescript
const [properties, total] = await this.properties.findAndCount({
  where, relations: { agent: true, media: true }, order: { createdAt: 'DESC', id: 'DESC' },
  skip: (query.page - 1) * query.limit, take: query.limit,
});
```

**Problema**: Cada listagem de imóveis (pública ou gerenciada) faz JOIN com `agents` E `property_media`. Na listagem pública, o frontend provavelmente precisa apenas da foto de capa e do nome do corretor — não de todas as mídias de todos os imóveis.

**Impacto**: Se um imóvel tem 20 mídias e a listagem retorna 20 imóveis, são 400 linhas de mídia retornadas + joins para cada request de listagem. Com tráfego alto, isso é IO e serialização desnecessários.

**Correção**: Considerar não carregar `media` na listagem e carregar apenas no detalhe. Ou usar um `select` para trazer apenas a mídia de capa:
```typescript
// Na listagem, não carregar media:
relations: { agent: true }, // sem media
// Adicionar campo coverUrl na entity ou um subselect
```

---

### ✅ Performance — O que está BEM feito

- **Paginação com limites**: Todas as queries usam `take` com máximo de 100. Nenhuma query pode retornar a tabela inteira.
- **`ConfigModule.cache: true`**: Variáveis de ambiente são lidas uma vez e cacheadas.
- **`retryAttempts: 1`**: A conexão com o banco não fica retentando indefinidamente.

---

## 5. Operação e Confiabilidade

### OPS-01 🟡 Médio — Sem health check endpoint

**Local**: Todo o backend — nenhum `/health` ou `/readiness`

**Problema**: Não existe nenhum endpoint de health check. Orquestradores (Docker, Kubernetes, Cloud Run, PM2) não têm como verificar se a aplicação está saudável.

**Impacto**: Em produção, se o banco de dados cair ou o R2 ficar indisponível, o load balancer continuará roteando tráfego para a instância doente. O auto-restart e auto-scaling não funcionam sem health checks.

**Correção**:
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

---

### OPS-02 🔵 Baixo — Sem timeout em chamadas externas ao R2/S3

**Local**: `src/media/media.module.ts` L19-25

```typescript
useFactory: (configuration: ConfigService) => new S3Client({
  region: 'auto', endpoint: configuration.getOrThrow<string>('R2_ENDPOINT'),
  credentials: {
    accessKeyId: configuration.getOrThrow<string>('R2_ACCESS_KEY_ID'),
    secretAccessKey: configuration.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
  },
}),
```

**Problema**: O `S3Client` é criado sem configuração de timeout. Se o R2 ficar lento ou indisponível, o upload ficará pendurado indefinidamente, segurando a request e a conexão do banco.

**Impacto**: Um timeout do R2 pode causar thread starvation no event loop do Node.js. Requests se acumulam e a API inteira fica irresponsiva.

**Correção**:
```typescript
useFactory: (configuration: ConfigService) => new S3Client({
  region: 'auto',
  endpoint: configuration.getOrThrow<string>('R2_ENDPOINT'),
  credentials: {
    accessKeyId: configuration.getOrThrow<string>('R2_ACCESS_KEY_ID'),
    secretAccessKey: configuration.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
  },
  requestHandler: {
    requestTimeout: 30_000,     // 30 segundos
    connectionTimeout: 5_000,   // 5 segundos
  },
}),
```

---

### OPS-03 🔵 Baixo — Sem versionamento de API

**Local**: `src/main.ts`, todos os controllers

**Problema**: A API não tem prefixo de versão (`/api/v1/`). Todos os endpoints estão diretamente em `/auth`, `/properties`, `/leads`, etc.

**Impacto**: Quando for necessário fazer breaking changes na API, não há como manter retrocompatibilidade para clientes existentes. Será preciso migrar tudo de uma vez.

**Correção**:
```typescript
// main.ts
application.setGlobalPrefix('api/v1');
```

---

### ✅ Operação — O que está BEM feito

- **`enableShutdownHooks()`**: O NestJS é configurado para graceful shutdown. (`main.ts` L19)
- **Validação de ambiente na inicialização**: App falha rápido com mensagem clara se faltar variável. (`env.validation.ts`)
- **Bootstrap de admin seguro**: O comando CLI (`bootstrap-admin.ts`) valida inputs, verifica se já existe admin, e fecha a conexão no `finally`. Não expõe endpoint HTTP.
- **Error handling no bootstrap**: Erros são capturados e mensagens genéricas são exibidas (sem stack trace para o usuário). (`bootstrap-admin.ts` L20-27)

---

## Tabela Resumo

| # | Sev | Categoria | Arquivo | Problema |
|---|-----|-----------|---------|----------|
| SEC-01 | 🟡 Médio | Segurança | `properties.controller.ts:20` | Slug sem validação de formato/tamanho |
| SEC-02 | 🟡 Médio | Segurança | `login-rate.guard.ts:7` | Rate limit in-memory não escala horizontalmente |
| SEC-03 | 🟡 Médio | Segurança | `leads.controller.ts:15-18` | Rota pública POST /leads sem rate limiting |
| SEC-04 | 🟡 Médio | Segurança | `main.ts` (ausência) | Sem headers de segurança (Helmet) |
| SEC-05 | 🔵 Baixo | Segurança | `create-property.dto.ts:72-74` | `features` aceita JSON arbitrário sem limites |
| SEC-06 | 🔵 Baixo | Segurança | `lead.entity.ts:27-34` | PII de leads em texto puro (LGPD) |
| DB-01 | 🟡 Médio | Banco | `session.service.ts` | Sessões expiradas nunca são limpas |
| DB-02 | 🟡 Médio | Banco | `property.entity.ts` | Índice faltando em `address_city` |
| DB-03 | 🟡 Médio | Banco | `media.service.ts:87-95` | `setCover`/`reorder` sem transação |
| DB-04 | 🔵 Baixo | Banco | `media.service.ts:44-55` | Uploads S3 sequenciais em loop |
| ARQ-01 | 🟡 Médio | Arquitetura | `main.ts` (ausência) | Sem exception filter global |
| ARQ-02 | 🔵 Baixo | Arquitetura | Todo `src/` | Zero logging na aplicação |
| ARQ-03 | 🔵 Baixo | Arquitetura | `agents.service.ts:60-63` | Check-then-act (mitigado por constraint) |
| PERF-01 | 🟡 Médio | Performance | `media.service.ts:25,47-49` | Upload carrega arquivos inteiros em memória |
| PERF-02 | 🔵 Baixo | Performance | `media.service.ts:44-55` | Uploads sequenciais ao S3 |
| PERF-03 | 🔵 Baixo | Performance | `properties.service.ts:82` | Listagem carrega todas as mídias |
| OPS-01 | 🟡 Médio | Operação | Ausência | Sem health check endpoint |
| OPS-02 | 🔵 Baixo | Operação | `media.module.ts:19-25` | S3Client sem timeout |
| OPS-03 | 🔵 Baixo | Operação | `main.ts` | Sem versionamento de API |

**Totais**: 0 🔴 Críticos | 0 🟠 Altos | **9** 🟡 Médios | **10** 🔵 Baixos

---

## Top 5 Quick Wins

Correções que dão mais resultado com menos esforço, ordenadas por impacto/esforço:

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 1 | **Instalar e configurar Helmet** (`npm i helmet` + 1 linha em `main.ts`) | 5 min | Adiciona 7+ headers de segurança de uma vez |
| 2 | **Adicionar rate limit na rota POST /leads** (copiar o padrão do `LoginRateGuard` e aplicar com `@UseGuards`) | 20 min | Bloqueia spam/abuso no endpoint público mais vulnerável |
| 3 | **Criar exception filter global** (1 arquivo + 1 linha em `main.ts`) | 15 min | Previne vazamento de stack traces e informações internas |
| 4 | **Adicionar health check** (1 controller simples) | 10 min | Habilita monitoramento e auto-restart em produção |
| 5 | **Criar cron de limpeza de sessões expiradas** (1 método + `@nestjs/schedule`) | 20 min | Previne crescimento ilimitado da tabela e custo no Neon |

---

## Nota Final

| Categoria | Nota | Justificativa |
|-----------|------|---------------|
| 🛡️ **Segurança** | **7.5/10** | Fundamentos sólidos (Argon2id, JWT rigoroso, CORS, CSRF guard, validação em DTOs), mas falta hardening HTTP (Helmet), rate limit em rotas públicas, e criptografia de PII. |
| 🗄️ **Banco de Dados** | **7.0/10** | Migrações manuais, constraints no banco, paginação obrigatória. Perde pontos por sessões não-limpas, índice faltando em city, e operações multi-step sem transação. |
| 🏗️ **Arquitetura** | **8.5/10** | Excelente separação de camadas, zero `any`, DTOs rigorosos, funções curtas, módulos bem definidos. Pontuação alta. Perde apenas por falta de logging e exception filter. |
| ⚡ **Performance** | **7.0/10** | Paginação correta e queries razoáveis. Pontos negativos: upload em memória sem stream, uploads sequenciais, e listagens que carregam relações desnecessárias. |
| 🔧 **Confiabilidade** | **6.5/10** | Graceful shutdown configurado e validação de env na inicialização. Mas sem health check, sem logging, sem timeout em chamadas externas, e sem versionamento de API. |
| **📊 GERAL** | **7.3/10** | Backend bem arquitetado com fundamentos de segurança sólidos para um MVP. As vulnerabilidades encontradas são de severidade média/baixa — nenhuma é crítica ou explorável trivialmente. O projeto está acima da média para seu estágio, mas precisa de hardening antes de produção real. |
