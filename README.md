# corretor-api

API REST do sistema da imobiliária de imóveis comerciais: catálogo público, contatos do site, painel dos
corretores, contratos de locação e comissões.

NestJS 11 sobre Express, TypeScript estrito, TypeORM 0.3 e PostgreSQL 16 no Neon. Mídia no Cloudflare R2 e
pastas de contratos no Google Drive compartilhado. Node `>=24 <25` e npm `>=11`.

Repositório irmão: **corretor-web** (React 18 + Vite 7 + SSR próprio), em `../Corretor-web`.

> Situação descrita: contrato v2, em vigor desde 16/09/2026 (ids inteiros e cadastro único de pessoas).
> A fonte de verdade é o código. O contrato detalhado está em
> [docs/handoffs/2026-09-16-ids-inteiros-pessoas.md](docs/handoffs/2026-09-16-ids-inteiros-pessoas.md).

## Situação atual (17/09/2026)

- Banco do Neon recriado do zero com as 10 migrations. Contém o administrador (id `1`) e os cadastros
  iniciais: 5 tipos de imóvel e 3 finalidades.
- API validada localmente contra o Neon: `GET /api/v1/saude`, catálogo e login respondem 200.
- O serviço no Render roda um commit antigo, com o contrato anterior, e **não funciona contra o banco atual**.
  A publicação precisa subir API e front v2 juntos, com o health check em `/api/v1/saude`.
- Pendências: aviso de novo contato ao corretor, regras de acesso a locações e comissões, CPF real do
  administrador e remoção das variáveis `BOOTSTRAP_ADMIN_*` do `.env`. Detalhes em [TASKS.md](TASKS.md).

## Instalação

```bash
npm ci
cp .env.example .env   # preencha os valores; o .env nunca vai para o Git
```

Testes, lint, tipos e build não precisam de `.env` nem de rede. Subir a API exige todas as variáveis
obrigatórias e o Neon acessível: não existe modo sem banco, e Postgres local é recusado.

## Comandos

| Ação | Comando | Precisa de `.env` e rede |
|---|---|---|
| Desenvolvimento com recarga | `npm run start:dev` | sim |
| Build | `npm run build` | não |
| Executar o build | `npm run start:prod` | sim |
| Testes | `npm test` | não |
| Lint | `npm run lint` | não |
| Tipos | `npm run typecheck` | não |
| Ver migrations pendentes | `npm run migration:show` | sim |
| Aplicar migrations | `npm run migration:run` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Reverter a última migration | `npm run migration:revert` | sim, com `MIGRACAO_BACKUP_ARQUIVO` |
| Criar o primeiro ADMIN | `npm run bootstrap:admin` | sim |

Antes de qualquer commit: `npm run typecheck`, `npm run lint` e `npm test`.

## Variáveis de ambiente

A validação roda no boot. Valor inválido encerra o processo, e a mensagem cita só o nome do campo.

| Variável | Regra | Obrigatória |
|---|---|---|
| `DATABASE_URL` | URL do Neon (`*.neon.tech`) com usuário, senha, banco e `sslmode=require`, `verify-ca` ou `verify-full`; só aceita os parâmetros `sslmode` e `channel_binding` | sim |
| `JWT_SECRET` | 32 caracteres ou mais | sim |
| `R2_ENDPOINT` | endpoint HTTPS S3 da conta Cloudflare, sem o bucket | sim |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | credenciais do token R2 | sim |
| `R2_PUBLIC_URL` | URL HTTPS pública do bucket `corretor-midia` | sim |
| `PORT` | padrão `3000` | não |
| `NODE_ENV` | `development`, `test` ou `production`; padrão `development` | não |
| `JWT_EXPIRES_IN` | número seguido de `s`, `m`, `h` ou `d`; padrão `15m` | não |
| `ALLOWED_ORIGINS` | origens exatas do front, separadas por vírgula, sem barra final; só HTTPS em produção | não |
| `R2_REQUEST_TIMEOUT_MS`, `R2_CONNECTION_TIMEOUT_MS` | padrões `30000` e `5000` | não |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_DRIVE_SHARED_DRIVE_ID` | Service Account e Drive compartilhado; as quatro juntas ou nenhuma; chave RSA de 2048 bits ou mais | não |
| `MIGRACAO_BACKUP_ARQUIVO` | caminho de um backup não vazio; exigido para executar ou reverter migrations | só no CLI |
| `MIGRACAO_COMPLEMENTOS_ARQUIVO`, `LEADS_ENCRYPTION_KEY` | usados só para migrar dados legados | só no CLI |
| `BOOTSTRAP_ADMIN_NAME`, `_EMAIL`, `_PASSWORD`, `_WHATSAPP`, `_CPF` | dados do primeiro ADMIN; **remover depois do uso** | só no bootstrap |
| `TESTE_LOCAL_DATABASE_URL` | PostgreSQL 16 local, por exemplo em Docker, para o teste de integração | só em teste |

Sem as variáveis do Drive, a API sobe normalmente e a criação de pastas de contrato responde com falha explícita.

## Rotas

Todas sob o prefixo `/api/v1`. A API também aceita as rotas sem o prefixo, porque o proxy do front o remove.

| Área | Rotas | Acesso |
|---|---|---|
| Saúde | `GET /saude` | público; testa o banco com `SELECT 1` |
| Sessão | `POST /autenticacao/entrar`, `/renovar`, `/sair`; `GET` e `PATCH /autenticacao/eu`; `PATCH /autenticacao/eu/senha` | login com guarda de origem e limite de tentativas; perfil com JWT |
| Corretores | `GET` e `POST /admin/corretores`; `GET`, `PATCH` e `DELETE /admin/corretores/:id` | ADMIN |
| Classificações | `GET /tipos-imovel`, `/finalidades-imovel`, `/caracteristicas`; CRUD em `/admin/tipos-imovel`, `/admin/finalidades-imovel`, `/admin/caracteristicas` | leitura pública dos ativos; escrita ADMIN |
| Imóveis | `GET /imoveis`, `GET /imoveis/:slug`; `GET` e `POST /admin/imoveis`; `GET`, `PATCH` e `DELETE /admin/imoveis/:id` | público; no painel, todos leem e só o dono ou ADMIN altera |
| Mídias | `POST /admin/imoveis/:imovel_id/midias` (multipart `arquivos`); `POST .../video-embed`; `PATCH .../ordem`; `PATCH .../:midia_id/capa`; `DELETE .../:midia_id` | dono do imóvel ou ADMIN |
| Pessoas | `POST /pessoas`; `GET` e `POST /admin/pessoas`; `GET`, `PATCH` e `DELETE /admin/pessoas/:id` | site com consentimento; no painel, responsável ou ADMIN |
| Contratos | `GET` e `POST /admin/contratos`; `GET`, `PATCH` e `DELETE /admin/contratos/:id`; `POST /admin/contratos/:id/pasta-drive` | intermediador ou ADMIN |
| Comissões | `GET` e `POST /admin/comissoes`; `GET`, `PATCH` e `DELETE /admin/comissoes/:id`; `PATCH /admin/comissoes/parcelas/:id/pagamento` | ADMIN, ou corretor responsável pelo imóvel e pela pessoa |

Convenções:

- Campos em português e `snake_case`. Ids são inteiros positivos; id inválido na URL responde 400.
- Listagens respondem `{ itens, total, pagina, limite, total_paginas }`, com `limite` máximo de 100.
- `DELETE` é exclusão lógica (`ativo = false`) e `PATCH { "ativo": true }` reativa. A exceção é a mídia,
  apagada do R2 e do banco.
- Valores monetários e áreas são texto decimal com até duas casas, por exemplo `"1500.00"`.
- Campo que não está no DTO responde 400 (`whitelist` e `forbidNonWhitelisted` no `ValidationPipe` global).
- Registro de outro corretor que a pessoa não pode ver responde 404, não 403.

## Sessão

- `POST /autenticacao/entrar` recebe `{ "email", "senha" }` e responde `{ token_acesso, tipo_token, corretor }`.
- O token de acesso é um JWT HS256 de 15 minutos, emissor `corretor-api`, audiência `corretor-web`. O front o
  mantém só em memória e o envia em `Authorization: Bearer`.
- O token de renovação vai no cookie `corretor_renovacao` (HttpOnly, Secure, SameSite=Strict, 30 dias). O banco
  guarda só o SHA-256. Cada renovação consome o token com `DELETE ... RETURNING` e emite outro.
- O cargo é relido do banco a cada requisição: desativar ou rebaixar um corretor vale na hora.
- Trocar a própria senha revoga todas as sessões do corretor. A redefinição feita pelo ADMIN não revoga.
- O cookie é sempre `Secure`, então o login pelo navegador exige HTTPS, inclusive em desenvolvimento.
- Limites em memória do processo: login com 10 tentativas por conta e 50 por IP a cada 15 minutos;
  contato do site com 5 envios por minuto por IP.

## Estrutura

```text
src/
  main.ts            helmet, filtro global de erros, prefixo /api/v1, CORS, ValidationPipe, porta
  app.module.ts      configuração validada, TypeORM, agendador e os módulos de domínio
  config/            validação do ambiente e opções de conexão com TLS verificado
  comum/             auditoria, validadores de CPF/CNPJ, telefone e data, decorators de DTO, datas
  common/filters/    filtro global de exceções
  autenticacao/      login, renovação, saída, perfil, guards, estratégia JWT e sessões
  corretores/        corretores, hash Argon2id e proteção do último ADMIN
  cadastros/         tipos, finalidades e características do catálogo
  imoveis/           catálogo público e gestão interna
  midias/            upload para o R2 e vídeos do YouTube e Vimeo
  pessoas/           contato do site com LGPD e cadastro manual
  locacoes/          contratos de locação
  comissoes/         comissões e parcelas
  drive/             cliente do Google Drive e registro de pastas
  saude/             health check
  database/          DataSource do CLI, registro de entidades e migrations, logger sem dados pessoais
  commands/          bootstrap do ADMIN e executor de migrations
  testing/           substituto do agendador usado nos testes
```

## Banco de dados

- `synchronize` e `migrationsRun` são `false`. O schema só muda por migration explícita.
- Migration aplicada nunca é editada, renomeada ou apagada: crie uma nova e registre-a em
  `src/database/registros.ts`.
- As duas últimas migrations recusam reversão automática. Voltar atrás exige restaurar backup.
- `1789084805000-hardening.ts` existe no disco, mas não está registrada e nunca roda.
- As migrations de 13/09 e 16/09 arquivam o modelo anterior nos schemas `legado_20260913` e `legado_20260916`,
  hoje vazios.
- Tabelas atuais: `corretores`, `sessoes_login`, `tipos_imovel`, `finalidades_imovel`, `caracteristicas`,
  `imoveis_caracteristicas`, `imoveis`, `imoveis_midias`, `pessoas`, `contrato`, `comissoes`,
  `parcelas_comissao`, `pastas_drive` e `typeorm_migrations`.
- Toda tabela de negócio tem `criado_em`, `alterado_em`, `criado_por` e `alterado_por`.

### Backup

Faça backup antes de qualquer mudança estrutural. O procedimento documentado usa `pg_dump` via Docker:

```bash
export PGURL="$(node -e "require('dotenv').config({quiet:true}); process.stdout.write(process.env.DATABASE_URL)")"
docker run --rm -e PGURL postgres:16 sh -c 'pg_dump --no-owner --no-privileges "$PGURL"' > backups/backup_$(date +%Y%m%d_%H%M).sql
unset PGURL
```

A máquina de desenvolvimento atual não tem Docker. Em 17/09 o backup foi exportado em JSON com o driver `pg`
do projeto. Arquivos de backup ficam em `backups/`, fora do Git.

## Mídia e documentos

- Bucket R2 `corretor-midia`, com nome fixo no código. Os uploads ficam em memória e vão direto ao R2, porque o
  disco do Render é apagado a cada reinício.
- Formatos aceitos: JPEG, PNG e WebP até 10 MB; MP4 e WebM até 30 MB; até 20 arquivos e 60 MB por lote.
  O tipo é conferido pelos primeiros bytes do arquivo.
- Documentos de contrato ficam no Google Drive compartilhado privado, em
  `Imobiliária/Contratos/{numero_contrato} - {locatário}`. Falha do Drive não desfaz o contrato: ele fica com
  `status_pasta_drive = FALHOU` e a rota `pasta-drive` tenta de novo.

## Testes

`npm test` roda as suítes Jest em série. Os testes HTTP sobem uma aplicação Nest real e trocam só os
repositórios por objetos em memória, então não precisam de banco nem de rede.

O teste de integração `src/database/modelo-portugues.integracao.spec.ts` roda as migrations em PostgreSQL real e
só executa com `TESTE_LOCAL_DATABASE_URL` definida.

Execução de 17/09/2026 nesta máquina: 174 testes aprovados, 4 ignorados e 1 falha por tempo esgotado em
`src/bootstrap.spec.ts`. Esse teste sobe o `main.ts` num subprocesso com limite de 15 segundos, que a máquina
atual, com a pasta sincronizada pelo OneDrive, ultrapassou.

Não têm teste automatizado: upload real no R2, criação real de pastas no Drive e a cadeia completa de migrations
sobre banco vazio.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/GUIA-DE-ESTUDO.md](docs/GUIA-DE-ESTUDO.md) | guia de estudo do projeto e do NestJS |
| [docs/ENTENDENDO-O-BACKEND.md](docs/ENTENDENDO-O-BACKEND.md) | referência técnica do código, módulo por módulo |
| [docs/handoffs/2026-09-16-ids-inteiros-pessoas.md](docs/handoffs/2026-09-16-ids-inteiros-pessoas.md) | contrato v2 entre API e front |
| [PROJECT_STATUS.md](PROJECT_STATUS.md), [TASKS.md](TASKS.md), [DECISIONS.md](DECISIONS.md), [CHANGELOG_AI.md](CHANGELOG_AI.md) | estado, tarefas, decisões e histórico dos agentes |
| [AGENTS.md](AGENTS.md) | regras e protocolo de trabalho |

Documentos em `docs/specs/`, `docs/plans/` e os handoffs anteriores a 16/09 são históricos.
