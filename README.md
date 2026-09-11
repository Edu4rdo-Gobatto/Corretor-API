# corretor-api

Fundação da API REST do sistema de corretor imobiliário. Backend separado do `corretor-web`, com NestJS 11, TypeScript, TypeORM e PostgreSQL hospedado no Neon.

## Estado da entrega

- [x] Projeto NestJS, dependências e scripts de desenvolvimento/verificação.
- [x] ConfigModule global com validação obrigatória de ambiente no boot.
- [x] Configuração TypeORM preparada para Neon, com TLS verificado.
- [x] Login JWT, perfil autenticado e cadastro de corretores restrito a ADMIN.
- [x] Entity Agent, hash Argon2id, guards de autenticação e autorização.
- [x] Migrations de corretores/imóveis e comando de criação do primeiro administrador preparados.
- [x] CRUD de imóveis, catálogo público com filtros/paginação e gestão com restrição por corretor.
- [x] Módulos vazios de mídia e leads.
- [x] Testes de configuração e falha de inicialização, sem serviços externos.
- [ ] Conexão real ao Neon: aguarda criação do projeto e configuração de DATABASE_URL.
- [ ] Integração R2: aguarda bucket, credenciais e implementação do módulo de mídia.

A próxima etapa de negócio é o módulo de mídia. As migrations estão escritas, mas não foram aplicadas ao Neon. Render, Vercel e deploy continuam pendentes; nenhum deploy automático foi configurado nesta entrega.

O progresso detalhado é mantido no [plano do projeto](PLANO-PROJETO-CORRETOR.md), com validações externas separadas das tarefas de código.

## Requisitos e instalação

Node.js 24.x (também indicado em `.nvmrc`) e npm 11 ou superior.

```powershell
npm ci
Copy-Item .env.example .env
```

Preencha `.env` antes de iniciar a API. Os testes e o build não precisam de `.env`, Neon ou R2. A aplicação exige toda a configuração abaixo; não há banco local nem modo de execução sem banco. Copiar o exemplo sem preencher os campos deve resultar em erro de inicialização.

## Variáveis de ambiente

| Variável | Regra |
|---|---|
| PORT | Inteiro entre 1 e 65535; padrão 3000 |
| NODE_ENV | development, test ou production; padrão development |
| DATABASE_URL | URL postgres:// ou postgresql:// do Neon, com usuário, senha, banco e sslmode=require, verify-ca ou verify-full |
| JWT_SECRET | Segredo aleatório de pelo menos 32 caracteres, não vazio |
| JWT_EXPIRES_IN | Inteiro positivo seguido de s, m, h ou d; padrão 15m |
| R2_ENDPOINT | URL HTTPS; use https://<account_id>.r2.cloudflarestorage.com |
| R2_ACCESS_KEY_ID | Chave de acesso não vazia |
| R2_SECRET_ACCESS_KEY | Segredo não vazio |
| R2_PUBLIC_URL | URL HTTPS pública do bucket, r2.dev ou domínio próprio |

Valores inválidos interrompem a inicialização e o erro lista apenas os nomes dos campos. Nunca comite `.env`, tokens ou dumps do banco. Os números de WhatsApp ficarão no cadastro de cada corretor, conforme as specs.

## Comandos

```powershell
npm run start:dev  # Desenvolvimento com watch, exige ambiente válido e Neon disponível
npm start          # Compila e inicia a API
npm run build      # Compila para dist/main.js
npm run start:prod # Executa o build existente
npm run lint       # ESLint, sem alterar arquivos
npm run typecheck  # Checagem TypeScript incluindo testes
npm test           # Testes locais, sem conexão externa
npm run test:watch
```

Com configuração, migration e conexão válidas, a aplicação escuta na porta configurada (3000 por padrão).

## Autenticação e corretores

| Endpoint | Acesso | Entrada / saída |
|---|---|---|
| POST /auth/login | Público | Recebe email e password; retorna accessToken, tokenType: Bearer e agent |
| GET /auth/me | JWT Bearer | Retorna o perfil atual do corretor |
| POST /agents | JWT Bearer + ADMIN | Cria corretor e retorna perfil sem senha/hash |

O cadastro aceita `name`, `email`, `password`, `whatsappNumber` e, opcionalmente, `creci`, `role` e `avatarUrl`. O papel padrão é AGENT; um ADMIN também pode cadastrar outro ADMIN. Senhas de cadastro têm 12 a 128 caracteres. WhatsApp deve conter somente dígitos com código do país (10 a 15 dígitos, sem zero inicial). O e-mail é normalizado para minúsculas e sem espaços nas extremidades, antes de verificar sua unicidade. Campos extras, como `passwordHash` e `active`, são rejeitados.

Credenciais incorretas e contas inativas recebem 401 no login. E-mail duplicado recebe 409; entrada inválida, 400. Cadastro sem token recebe 401 e cadastro por AGENT recebe 403. O JWT usa HS256, issuer `corretor-api` e audience `corretor-web`. A cada requisição protegida o corretor é consultado novamente: contas inativas/removidas perdem acesso e alterações de papel passam a valer mesmo para tokens já emitidos.

A API entrega access token para uso em memória e refresh token em cookie httpOnly rotativo. Logout/revogação, origens autorizadas e limitação de login estão implementados; consulte os contratos e limites operacionais na seção de integração abaixo.

## Preparar o banco e o primeiro administrador

Depois de configurar o ambiente real e fazer backup de um banco existente:

```powershell
npm run migration:show
npm run migration:run
```

As migrations criam a tabela agents e, depois, properties, com enums, UUIDs, constraints e índices. Elas não são executadas no boot. `npm run migration:revert` desfaz a última migration e apaga a tabela correspondente (properties ou agents); use somente quando for apropriado perder esses dados.

Para o primeiro administrador, preencha temporariamente no `.env` as variáveis `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` e `BOOTSTRAP_ADMIN_WHATSAPP` (comentadas no exemplo), e execute:

```powershell
npm run bootstrap:admin
```

O comando valida os dados antes de conectar, gera Argon2id, cria ADMIN e informa apenas o ID. Se já existir um ADMIN, ele recusa a operação sem redefinir credenciais. Remova as variáveis de bootstrap após o uso. Não existe rota pública de criação do primeiro administrador. A API normal não exige essas variáveis.

## Imóveis

| Endpoint | Comportamento |
|---|---|
| GET /properties | Catálogo público paginado |
| GET /properties/:slug | Detalhe público por slug |
| GET /admin/properties | Lista autenticada, incluindo todos os status |
| GET /admin/properties/:id | Detalhe para edição, por UUID |
| POST /properties | Cria imóvel, exige JWT |
| PATCH /properties/:id | Atualiza campos fornecidos, exige JWT |
| DELETE /properties/:id | Exclui imóvel, retorna 204, exige JWT |

O catálogo mostra somente DISPONIVEL e corretores ativos. RESERVADO/CONCLUIDO ficam disponíveis na gestão. AGENT só consulta/edita/exclui seus próprios imóveis na gestão; ADMIN pode gerenciar todos. A tentativa de acessar um imóvel alheio retorna 404. Somente ADMIN pode fornecer `agentId` diferente do próprio ID para atribuir/repassar imóveis a outro corretor ativo. O prefixo `/admin` identifica o painel, não exige papel ADMIN para visualizar os próprios imóveis.

Filtros de ambas as listagens: `type` (GALPAO/SALA/PREDIO/LOJA/TERRENO), `purpose` (LOCACAO/VENDA), `city` (correspondência exata sem diferenciar maiúsculas), `minPrice` e `maxPrice`. Paginação por `page` (padrão 1) e `limit` (padrão 20, máximo 100), ordenada por criação decrescente e UUID como desempate. Resposta: `{ items, total, page, limit, totalPages }`. Intervalos de preço invertidos são rejeitados.

Cadastro exige `title`, `type`, `purpose`, `price`, `usableArea`, `totalArea`, `addressStreet`, `addressNumber`, `addressCity`, `addressState`, `neighborhood` e `description`. Aceita `condoFee`, `iptuFee`, `features`, `status` e `agentId`. A UF deve ser uma sigla brasileira válida. Preços/taxas são números JSON não negativos com até duas casas decimais; áreas são positivas e a útil não pode superar a total. Taxas opcionais podem ser limpas com null. Campos omitidos em PATCH preservam os valores anteriores. O slug é gerado com título/UUID e permanece estável após alterações de título.

As respostas incluem contato público do corretor (nome, WhatsApp, CRECI e avatar), sem e-mail, senha/hash ou papel de acesso. Valores numéricos do PostgreSQL são convertidos para números JSON. Fotos, vídeos e galeria ainda não são implementados nesta etapa.

## Estrutura

```text
src/
  config/       # Validação de ambiente e opções do TypeORM
  auth/         # Login, JWT strategy, guards e decorators
  agents/       # Entity, DTOs e criação de corretores
  commands/     # Bootstrap do primeiro administrador
  database/     # DataSource e migrations explícitas
  properties/   # Entity, DTOs, catálogo e gestão de imóveis
  media/        # Módulo vazio de mídia
  leads/        # Módulo vazio de leads
  common/
    filters/
    interceptors/
    security/   # Hash e verificação de senha compartilhados
  app.module.ts
  main.ts
```

Os módulos seguirão entity + dto + service + controller quando os respectivos comportamentos forem implementados. Não há rotas fictícias ou persistência em memória para substituir integrações pendentes.

## Banco e mídia

TypeORM usa exclusivamente DATABASE_URL. `synchronize: false`, `migrationsRun: false` e `installExtensions: false` impedem alterações automáticas do schema/extensões. PostgreSQL 16 fornece gen_random_uuid() para a migration. Backups manuais devem preceder mudanças estruturais em um banco existente.

A configuração remove parâmetros SSL da URL antes de passá-la ao driver e define `rejectUnauthorized: true` explicitamente, mantendo a verificação do certificado. A conexão tem timeout de 10 segundos e não mantém um ciclo prolongado de retentativas no boot.

A URL aceita somente os parâmetros `sslmode` e `channel_binding`, sem duplicatas. Parâmetros extras são rejeitados para impedir que o driver sobrescreva o host Neon ou desative TLS.

Arquivos de mídia deverão ir para Cloudflare R2; o backend não deve persistir uploads no disco efêmero do Render. Nenhum cliente R2 ou upload foi implementado ainda.

## Dependências e verificação

O lockfile registra as versões instaladas. O override `multer: 2.3.0` corrige os alertas da versão 2.2.0 fixada pelo adaptador Express do NestJS. Reavaliar o override quando o adaptador atualizar essa dependência.

A suíte verifica configuração, erros sem segredos, opções de conexão, Argon2id, tokens e guards, cadastro e login via HTTP local, proteção de hashes nas consultas, validação do bootstrap e CRUD/filtros/paginação/posse de imóveis. Somente a persistência é substituída nos testes HTTP; não existe banco em memória no código de produção. Conexão real, aplicação das migrations, certificado do Neon e acesso ao R2 permanecem pendentes.

Referências de implementação: [Configuração NestJS](https://docs.nestjs.com/techniques/configuration) e [Integração TypeORM](https://docs.nestjs.com/techniques/database).

## Integração com Corretor-web

O front usa /api como proxy e remove esse prefixo: /api/auth/login chega a /auth/login.
Configure ALLOWED_ORIGINS com as origens exatas autorizadas, separadas por vírgula,
sem barra final (ex.: https://imoveis.example.com). O CORS aceita credenciais somente
nessas origens; login, refresh e logout recusam Origin não autorizado e metadados
de navegação cross-site sem Origin. Clientes HTTP sem cabeçalhos de navegador
continuam permitidos. Em produção, use HTTPS e NODE_ENV=production.

- POST /auth/login: JSON {email,password}; retorna {accessToken,tokenType,agent}
  e define corretor_refresh em cookie httpOnly, SameSite=Strict, Path=/, Secure em produção.
- POST /auth/refresh: envia o cookie e retorna o mesmo formato, rotacionando o cookie.
- POST /auth/logout: revoga o cookie atual, limpa-o e retorna 204.
- GET /auth/me: recebe Authorization: Bearer e retorna o perfil atual.
- Access token padrão: 15 minutos; o front deve mantê-lo somente em memória.
  Refresh token: 30 dias por renovação, aleatório, persistido somente como SHA-256.
  DELETE RETURNING torna o refresh de uso único mesmo com requisições concorrentes.
  O front deve coordenar renovações para evitar disparar refresh concorrente.
- GET /agents?page=1&limit=20: ADMIN; {items,total,page,limit,totalPages}; limite máximo 100.
- PATCH /agents/:id: ADMIN; campos opcionais de criação e active booleano. Senha omitida
  permanece intacta. Desativação preserva vínculos; o último ADMIN ativo não pode ser
  desativado ou rebaixado. Edições são serializadas por advisory lock transacional.
- Listagens de imóveis incluem mídia para exibir capa. Permissões usam a conta e
  o papel atuais do banco em cada requisição; conta inativa não renova sessão.

A migração 1789084804000 cria refresh_sessions e deve ser revisada e executada no Neon
autorizado antes de iniciar a versão nova. Nenhuma migração foi executada nesta entrega.
Inclua limpeza periódica de refresh_sessions WHERE expires_at < now() na manutenção
do banco. Logout revoga o refresh atual; um access token já emitido pode durar até sua
expiração (ou desativação da conta).

Login tem janela de 15 minutos, com 10 tentativas por conta e 50 por IP. O limite é
local ao processo, inclusive reinicia com o processo; antes de escalar para múltiplas
instâncias, complemente no gateway com armazenamento compartilhado. Configure o
proxy confiável conforme sua infraestrutura; o bootstrap atual confia em um salto.

Validação de integração real com Neon/R2 exige ambiente e credenciais autorizados.
Os testes HTTP substituem somente os repositórios e o armazenamento externo;
não comprovam a execução de SQL no PostgreSQL nem upload real no R2.

Caso a descoberta padrão do Jest omita arquivos hidratados no Windows/OneDrive,
execute todos os testes explicitamente em PowerShell:

```powershell
$specs = @(rg --files src -g '*.spec.ts')
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath @specs
```
