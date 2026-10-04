# Plano de Projeto — Sistema de Corretor Imobiliário

> Versão consolidada após revisão de arquitetura. Documento de referência único — consulte aqui antes de tomar qualquer decisão de stack ou estrutura durante o desenvolvimento.

---

## 1. Princípios do Projeto (não negociáveis)

Antes de qualquer linha de código, esses princípios guiam toda decisão técnica daqui pra frente:

1. **Custo $0 durante validação.** Nenhuma ferramenta paga entra no projeto até haver confirmação de que um corretor vai pagar pelo produto.
2. **Banco de dados sempre online.** Nunca rodar Postgres local — elimina dependência de máquina ligada e riscos de perda de dados.
3. **Simplicidade de código acima de sofisticação arquitetural.** Um padrão por problema, uma ferramenta por função. Nada de duas soluções pra mesma coisa (um ORM só, uma lib de validação só).
4. **Sem atalhos que geram dívida técnica silenciosa.** Filesystem efêmero, cold start, limites de free tier — tudo documentado e decidido conscientemente, nunca ignorado.

---

## 2. Arquitetura Geral

```
[ Visitante / Corretor ]
           │
           ▼
[ Vercel ] ──────────────────── Frontend: React + TypeScript + Vite
           │
           ▼ (HTTPS / JSON / Multipart)
[ Render ] ──────────────────── Backend: NestJS + TypeScript
     │                    │
     │ (TypeORM/TCP)      │ (S3 SDK)
     ▼                    ▼
[ Neon PostgreSQL ]  [ Cloudflare R2 ] ── Storage: fotos e vídeos
```

Backend é um servidor Node.js tradicional (não edge, não serverless de CPU limitado). Isso importa: significa que autenticação, upload de arquivos e qualquer lógica de negócio rodam sem restrição artificial de tempo de CPU.

---

## 3. Stack Tecnológica Completa

| Camada | Tecnologia | Hospedagem | Custo validação |
|---|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Vercel (free) | $0 |
| Backend | NestJS + TypeScript | Render (free) | $0 |
| Banco de dados | PostgreSQL 16 | Neon (free, 3GB) | $0 |
| ORM | TypeORM | — | $0 |
| Storage de mídia | Cloudflare R2 (S3-compatible) | Cloudflare (free, 10GB) | $0 |
| Autenticação | JWT + Argon2id | — | $0 |
| Validação | class-validator + class-transformer (backend), react-hook-form + zod (frontend) | — | $0 |
| Backup | pg_dump manual | Máquina local | $0 |

**Custo total de validação: $0/mês.**
**Custo pós-validação estimado:** Render Starter ($7/mês, elimina cold start) — único gasto necessário quando o produto tiver o primeiro cliente pagante.

### Decisões descartadas (e por quê, para não reabrir a discussão sem motivo novo)

| Descartado | Motivo |
|---|---|
| Supabase | Free tier pausa projeto após inatividade prolongada — wake time de 30-60s inaceitável para cliente final |
| Cloudflare Workers + Hono no backend | Limite de 10ms de CPU no free tier é incompatível com hash de senha seguro (Argon2id/bcrypt exigem 100-300ms por design); bcrypt nativo nem roda no runtime V8 isolado |
| Drizzle ORM | Só fazia sentido no cenário Workers; TypeORM é mais maduro para o padrão NestJS e evita ter dois ORMs em mente |
| GitHub Actions para backup automatizado | Workflows agendados são desabilitados após 60 dias sem atividade no repo e a execução em horário fixo não é garantida — inadequado pra algo crítico como backup |
| Cloudflare Containers | Exige Workers Paid Plan ($5/mês mínimo) — não é free |

---

## 4. Estrutura de Repositórios

```
corretor-api/                  (NestJS)
├── src/
│   ├── config/
│   │   └── env.validation.ts       # Valida variáveis de ambiente no boot
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── guards/roles.guard.ts
│   │   ├── decorators/roles.decorator.ts
│   │   └── dto/
│   ├── agents/
│   │   ├── agent.entity.ts
│   │   ├── agents.module.ts
│   │   ├── agents.service.ts
│   │   ├── agents.controller.ts
│   │   └── dto/
│   ├── properties/
│   │   ├── property.entity.ts
│   │   ├── properties.module.ts
│   │   ├── properties.service.ts
│   │   ├── properties.controller.ts
│   │   └── dto/
│   ├── media/
│   │   ├── property-media.entity.ts
│   │   ├── media.module.ts
│   │   ├── media.service.ts        # Client S3 apontando pro R2
│   │   └── media.controller.ts
│   ├── leads/
│   │   ├── lead.entity.ts
│   │   ├── leads.module.ts
│   │   ├── leads.service.ts
│   │   └── leads.controller.ts
│   ├── common/
│   │   ├── filters/
│   │   └── interceptors/
│   ├── app.module.ts
│   └── main.ts
├── .env.example
└── package.json

corretor-web/                  (React + Vite)
├── src/
│   ├── components/
│   │   ├── PropertyCard.tsx
│   │   ├── MediaGallery.tsx
│   │   └── LeadFormModal.tsx
│   ├── pages/
│   │   ├── public/
│   │   │   ├── Catalog.tsx
│   │   │   ├── PropertyDetail.tsx
│   │   │   └── PrivacyPolicy.tsx
│   │   └── admin/
│   │       ├── Login.tsx
│   │       ├── Dashboard.tsx
│   │       ├── PropertyList.tsx
│   │       ├── PropertyForm.tsx
│   │       └── LeadsList.tsx
│   ├── services/
│   │   ├── api.ts                  # Cliente HTTP central (axios/fetch)
│   │   ├── auth.service.ts
│   │   ├── properties.service.ts
│   │   └── leads.service.ts
│   ├── hooks/
│   │   └── useAuth.ts
│   ├── types/
│   │   └── index.ts                # Tipos compartilhados (Property, Agent, Lead)
│   └── main.tsx
├── .env.example
└── package.json
```

**Regra de simplicidade:** todo módulo do backend segue o mesmo padrão — `entity` + `dto/` + `service` + `controller` + `module`. Nenhum módulo foge disso. Se um dia parecer necessário fugir, é sinal de que o problema deveria ser resolvido em outra camada, não que o padrão está errado.

---

## 5. Modelagem do Banco de Dados

### 5.1 Agent (corretores e admin)

```typescript
// src/agents/agent.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Property } from '../properties/property.entity';

export enum AgentRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'whatsapp_number' })
  whatsappNumber: string;

  @Column({ nullable: true })
  creci: string;

  @Column({ type: 'enum', enum: AgentRole, default: AgentRole.AGENT })
  role: AgentRole;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Property, (property) => property.agent)
  properties: Property[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### 5.2 Property (imóveis comerciais)

```typescript
// src/properties/property.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { PropertyMedia } from '../media/property-media.entity';

export enum PropertyType {
  GALPAO = 'GALPAO',
  SALA = 'SALA',
  PREDIO = 'PREDIO',
  LOJA = 'LOJA',
  TERRENO = 'TERRENO',
}

export enum PropertyPurpose {
  LOCACAO = 'LOCACAO',
  VENDA = 'VENDA',
}

export enum PropertyStatus {
  DISPONIVEL = 'DISPONIVEL',
  RESERVADO = 'RESERVADO',
  CONCLUIDO = 'CONCLUIDO',
}

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Index({ unique: true })
  @Column()
  slug: string;

  @Column({ type: 'enum', enum: PropertyType })
  type: PropertyType;

  @Column({ type: 'enum', enum: PropertyPurpose })
  purpose: PropertyPurpose;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'condo_fee', type: 'numeric', precision: 10, scale: 2, nullable: true })
  condoFee: number;

  @Column({ name: 'iptu_fee', type: 'numeric', precision: 10, scale: 2, nullable: true })
  iptuFee: number;

  @Column({ name: 'usable_area', type: 'numeric', precision: 10, scale: 2 })
  usableArea: number;

  @Column({ name: 'total_area', type: 'numeric', precision: 10, scale: 2 })
  totalArea: number;

  @Column({ name: 'address_street' })
  addressStreet: string;

  @Column({ name: 'address_number' })
  addressNumber: string;

  @Column({ name: 'address_city' })
  addressCity: string;

  @Column({ name: 'address_state' })
  addressState: string;

  @Column()
  neighborhood: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  features: Record<string, unknown>; // ex: { docas: 4, peDireito: 10, vagas: 12 }

  @Column({ type: 'enum', enum: PropertyStatus, default: PropertyStatus.DISPONIVEL })
  status: PropertyStatus;

  @ManyToOne(() => Agent, (agent) => agent.properties)
  agent: Agent;

  @OneToMany(() => PropertyMedia, (media) => media.property)
  media: PropertyMedia[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 5.3 PropertyMedia (fotos e vídeos)

```typescript
// src/media/property-media.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Property } from '../properties/property.entity';

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO_EMBED = 'VIDEO_EMBED', // link do YouTube/Vimeo
  VIDEO_FILE = 'VIDEO_FILE',   // arquivo direto no R2
}

@Entity('property_media')
export class PropertyMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Property, (property) => property.media, { onDelete: 'CASCADE' })
  property: Property;

  @Column({ type: 'enum', enum: MediaType })
  type: MediaType;

  @Column()
  url: string;

  @Column({ name: 'storage_key', nullable: true })
  storageKey: string; // chave no bucket R2, usada para deletar depois

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'is_cover', default: false })
  isCover: boolean;
}
```

### 5.4 Lead (captação com auditoria LGPD)

```typescript
// src/leads/lead.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Property } from '../properties/property.entity';
import { Agent } from '../agents/agent.entity';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Property, { onDelete: 'SET NULL', nullable: true })
  property: Property;

  @ManyToOne(() => Agent)
  agent: Agent;

  @Column({ name: 'lead_name' })
  leadName: string;

  @Column({ name: 'lead_phone' })
  leadPhone: string;

  @Column({ name: 'lead_email', nullable: true })
  leadEmail: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  // Auditoria LGPD — obrigatório para qualquer lead capturado
  @Column({ name: 'consent_given' })
  consentGiven: boolean;

  @Column({ name: 'consent_timestamp' })
  consentTimestamp: Date;

  @Column({ name: 'consent_ip' })
  consentIp: string;

  @Column({ name: 'terms_version', default: 'v1.0' })
  termsVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## 6. Autenticação e Segurança

### 6.1 Fluxo

1. `POST /auth/login` recebe email + senha
2. `AuthService` busca o `Agent` pelo email, compara a senha com `argon2.verify()`
3. Se válido, gera JWT com payload `{ sub: agent.id, role: agent.role }`
4. Frontend guarda o token (em memória + refresh via httpOnly cookie — nunca em `localStorage` puro para dados sensíveis)
5. Rotas protegidas usam `JwtAuthGuard` + `RolesGuard` combinados

### 6.2 Hash de senha

```bash
npm install argon2
```

```typescript
import * as argon2 from 'argon2';

// No cadastro
const passwordHash = await argon2.hash(plainPassword);

// No login
const isValid = await argon2.verify(agent.passwordHash, plainPassword);
```

Argon2id é o algoritmo recomendado atualmente (vencedor da Password Hashing Competition, recomendado pela OWASP). Roda sem restrição em servidor Node normal — não há trade-off de segurança vs. velocidade aqui.

### 6.3 Guards e Roles

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Uso no controller
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Post('agents')
createAgent(@Body() dto: CreateAgentDto) { ... }
```

Regra: rotas de **listagem pública de imóveis** ficam sem guard. Rotas de **CRUD administrativo** exigem `JwtAuthGuard`. Rotas de **gestão de corretores** exigem adicionalmente `Roles('ADMIN')`.

---

## 7. Pipeline de Mídia (Cloudflare R2)

### 7.1 Por que R2 é obrigatório, não opcional

O filesystem do Render é efêmero — qualquer arquivo salvo localmente no servidor é **apagado** toda vez que o serviço reinicia ou "dorme" no free tier. Fotos de imóvel não podem, em hipótese nenhuma, ser salvas no disco do backend.

### 7.2 Setup do bucket

1. No painel da Cloudflare, criar bucket `corretor-midia`
2. Gerar API Token com permissão de leitura/escrita (Account → R2 → Manage API Tokens)
3. Anotar: `Account ID`, `Access Key ID`, `Secret Access Key`, endpoint (`https://<account_id>.r2.cloudflarestorage.com`)
4. Ativar acesso público de leitura via subdomínio `r2.dev` (suficiente para validação; domínio customizado fica para pós-validação)

### 7.3 Configuração no backend

```bash
npm install @aws-sdk/client-s3
```

```typescript
// media.service.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async uploadFile(buffer: Buffer, key: string, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: 'corretor-midia',
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

### 7.4 Compressão no frontend (antes do upload)

```bash
npm install browser-image-compression
```

Reduz o arquivo para WebP, máximo 1920x1080, antes de enviar — economiza os 10GB do free tier e acelera o upload. Isso roda no navegador do corretor, sem custo de infraestrutura.

### 7.5 Regras de vídeo

- Preferência: link do YouTube (não listado) ou Vimeo — armazena só a URL, zero custo de storage
- Se precisar de arquivo direto: limite de 30MB validado no frontend antes do envio ao R2

---

## 8. Fluxo de Leads e WhatsApp

```
Visitante preenche formulário (nome, telefone, checkbox LGPD)
           │
           ▼
Clique em "Falar com o corretor"
           │
    ┌──────┴──────┐
    ▼             ▼
Abre wa.me    POST assíncrono
imediatamente  para /leads (não bloqueia a UI)
```

```typescript
// Frontend: abertura imediata do WhatsApp
const whatsappUrl = `https://wa.me/${agent.whatsappNumber}?text=${encodeURIComponent(
  `Olá ${agent.name}, tenho interesse no imóvel ${property.title} (Ref: ${property.id}).`
)}`;
window.open(whatsappUrl, '_blank');

// Registro do lead em paralelo, sem travar a navegação
fetch(`${API_URL}/leads`, {
  method: 'POST',
  body: JSON.stringify(leadData),
  headers: { 'Content-Type': 'application/json' },
});
```

O backend valida `consentGiven === true` obrigatoriamente antes de salvar — sem consentimento, a requisição é rejeitada com 400.

---

## 9. Variáveis de Ambiente

### corretor-api/.env.example

```env
# Aplicação
PORT=3000
NODE_ENV=development

# Banco de dados (Neon)
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/corretor-db?sslmode=require

# JWT
JWT_SECRET=defina_uma_chave_forte_aqui
JWT_EXPIRES_IN=7d

# Cloudflare R2
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=https://<bucket>.r2.dev
```

### corretor-web/.env.example

```env
VITE_API_URL=http://localhost:3000
```

O número de WhatsApp de cada corretor fica no banco de dados (campo `whatsapp_number` do `Agent`), não em variável de ambiente — cada corretor tem o seu.

---

## 10. Backup

```bash
pg_dump "postgresql://usuario:senha@host.neon.tech/corretor-db?sslmode=require" > backup_$(date +%Y%m%d).sql
```

Execute manualmente antes de qualquer mudança estrutural grande no banco (nova migration, alteração de schema) e semanalmente durante a validação. Guarde os arquivos em uma pasta local com data no nome. Automação fica para pós-validação.

---

## 11. Roteiro de Execução — Passo a Passo

### Acompanhamento da implementação — 10/09/2026

Código do backend implementado na branch `codex/backend-foundation` do repositório Corretor-API. As caixas marcadas abaixo correspondem a código ou configuração verificados localmente. Conexão com Neon, aplicação da migration, criação real do administrador e serviços externos permanecem pendentes; nenhum banco local foi criado.

Atualização de 11/09/2026: frontend público e painel administrativo implementados na branch `codex/editorial-frontend` do repositório Corretor-web; integração de sessão, gestão de corretores e ajustes de segurança implementados na branch `codex/frontend-integration` do Corretor-API. Testes automatizados, lint, typecheck e build passaram localmente. As caixas continuam desmarcadas quando dependem de credenciais ou validação em serviços externos.

### Fase 1 — Fundação de Infraestrutura
- [ ] Projeto Neon criado, connection string salva
- [ ] Bucket R2 criado, API token gerado, credenciais salvas
- [x] Repositórios `corretor-api` e `corretor-web` criados no GitHub
- [ ] Conta Render criada, ainda sem deploy
- [ ] Conta Vercel criada, ainda sem deploy

### Fase 2 — Backend: Fundação do NestJS
- [x] `npm install` de todas as dependências (TypeORM, pg, class-validator, class-transformer, @nestjs/config, @nestjs/jwt, @nestjs/passport, passport-jwt, argon2, @aws-sdk/client-s3)
- [x] `ConfigModule` configurado com validação de variáveis de ambiente no boot (falha rápido se faltar alguma)
- [x] Configuração do `TypeOrmModule` preparada para Neon, TLS verificado e `synchronize: false`
- [ ] Conexão real do `TypeOrmModule` ao Neon — aguarda configuração externa
- [x] Estrutura de pastas dos módulos criada (mesmo vazios)

### Fase 3 — Módulo de Autenticação
- [x] Entity `Agent` criada com migration inicial
- [ ] Migration aplicada/sincronização validada no Neon — aguarda configuração externa
- [x] `AuthService` com verificação Argon2id e hash compartilhado via `PasswordService`
- [x] `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `Roles` decorator
- [x] Endpoints: login, criação de corretor (admin only), `/auth/me`
- [x] Comandos explícitos de migration e criação do primeiro ADMIN, sem senha padrão
- [x] Testes locais: login/cadastro via HTTP, tokens inválidos/expirados, roles atuais, conta inativa, hash protegido e configuração
- [ ] Teste manual via Postman/Insomnia com Neon: login retorna token válido
- [x] Antes de integrar/publicar o painel: refresh via cookie httpOnly, logout/revogação, CORS e limitação de tentativas de login

### Fase 4 — Módulo de Imóveis
- [x] Entity `Property` com enums, constraints e migration inicial
- [x] DTOs de criação/atualização com validação
- [x] CRUD completo + filtros (tipo, finalidade, cidade, faixa de preço)
- [x] Paginação na listagem pública
- [ ] Teste manual com Neon: criar, listar, filtrar, editar, deletar um imóvel

### Fase 5 — Módulo de Mídia
- [x] Client S3 configurado apontando pro R2
- [x] Entity `PropertyMedia`
- [x] Endpoint de upload (multipart), validação de tipo/tamanho de arquivo
- [x] Endpoint de reordenação e marcação de capa
- [x] Endpoint de exclusão (remove do R2 e do banco)
- [ ] Teste manual: upload de 3 fotos, marcar uma como capa, deletar uma

### Fase 6 — Módulo de Leads
- [x] Entity `Lead` com campos LGPD
- [x] Endpoint público de criação (valida consentimento obrigatório)
- [x] Endpoint protegido de listagem (painel do corretor)
- [x] Endpoint de exclusão (direito do titular)
- [ ] Teste manual: enviar lead sem consentimento (deve rejeitar), com consentimento (deve salvar)

### Fase 7 — Frontend Público
- [x] Rotas configuradas (react-router-dom)
- [x] Página de catálogo com filtros consumindo a API
- [x] Página de detalhe com galeria de mídia
- [x] Formulário de lead com checkbox LGPD e redirecionamento WhatsApp
- [x] Página de Política de Privacidade (com campos institucionais configuráveis antes da publicação)

### Fase 8 — Painel Administrativo
- [x] Tela de login consumindo `/auth/login`
- [x] Dashboard simples (total de imóveis, leads recentes)
- [x] CRUD de imóveis com upload de mídia (compressão client-side incluída)
- [x] Listagem e gestão de leads
- [x] Gestão de corretores (visível só para ADMIN)

### Fase 9 — Deploy
- [ ] Backend no Render: repositório conectado, variáveis de ambiente configuradas, build e start commands corretos
- [ ] Frontend na Vercel: repositório conectado, `VITE_API_URL` apontando pro backend em produção
- [ ] Teste ponta a ponta em produção: cadastrar imóvel → upload de fotos → visualizar publicamente → enviar lead → confirmar redirecionamento WhatsApp → confirmar lead salvo no painel
- [ ] Primeiro backup manual do banco em produção

### Fase 10 — Fora do escopo da validação (decidido conscientemente)
- Preview de Open Graph para WhatsApp/LinkedIn (crawler detection)
- Backup automatizado
- Multi-tenant (múltiplas imobiliárias isoladas)
- Migração para Cloud Run (só se cold start virar problema real em demonstração pra cliente)

---

## 12. Regra de Ouro para Manutenção Futura

Sempre que for adicionar uma feature nova, pergunte antes de escrever código:

1. Ela cabe no padrão `entity + dto + service + controller` já existente?
2. Ela precisa de uma biblioteca nova, ou uma já instalada resolve?
3. Ela está no escopo da validação, ou é uma otimização prematura pra um problema que ainda não existe?

Se a resposta de qualquer uma dessas for "não", pare e questione antes de seguir — é exatamente esse tipo de decisão que gerou a complexidade que descartamos nesse planejamento.


## Atualização compartilhada — 12/09/2026: administração de locações

Esta atualização prevalece sobre marcações históricas de escopo. A versão anterior divergente da API foi preservada em docs/handoffs/2026-09-12-plano-anterior-api.md no repositório da API.

Primeira entrega aprovada: proprietário → inquilino → contrato → documentos privados, exclusivamente ADMIN. Fichas completas PF/PJ, dados bancários do proprietário, busca, paginação, datas e valor contratual. Um imóvel e uma parte de cada tipo por contrato. Cadastros e contratos são mantidos no histórico; documentos têm download autenticado, nunca URL pública.

Implementação: entidades rental_parties, leases, rental_documents; módulo rentals; rotas administrativas dos dois repositórios. Detalhes em docs/plans/2026-09-12-rental-administration.md e corretor-spec.json. Migration e bucket privado precisam de homologação real antes da operação.

Etapa financeira futura: a regra de comissão está explicitamente pendente. Recebimentos e repasses serão registrados manualmente no primeiro MVP financeiro; integrações bancárias não estão aprovadas. SI9/Imonov permanecem independentes; carga inicial manual. Relatórios, cobranças e alertas não foram implementados nesta primeira entrega.

## 2026-09-14 — Atualização do plano: backend integral

O modelo de 13/09/2026 em docs/specs/2026-09-13-backend-integral.md substitui a arquitetura de negócio anterior: cadastros em português, partes em colunas pesquisáveis, contratos e pastas privadas no Drive compartilhado, receita em comissões parceladas. O texto anterior permanece como histórico; a implementação vigente está descrita em docs/handoffs/2026-09-14-backend-portugues.md e corretor-spec.json.

Sequência de publicação: validar backend isolado → adaptar frontend/SSR/autenticação/classificações/financeiro → homologar Drive e R2 reais → completar CPF/campos reais e verificar backup → migrar banco e publicar API/front em corte coordenado, incluindo health check /api/v1/saude. Não publicar API nova sobre o frontend antigo. Sem commit/deploy nesta entrega.
