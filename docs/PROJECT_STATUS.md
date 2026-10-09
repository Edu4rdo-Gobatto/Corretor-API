# Estado atual — corretor-api

## 2026-10-09 — Claude: correção dos seis pontos (API)

Concluído localmente. CRECI validado no DTO-base (criar, atualizar, perfil JSON/multipart); `tipo_id` em CSV no
catálogo público e admin; novo `GET /admin/comissoes/pessoas-elegiveis`. Typecheck, lint e build aprovados; `npm test`
sem suítes ("No tests found"). QA efêmero 78/78 com módulos reais, ValidationPipe do main.ts, JWT real e PostgreSQL 16
descartável em Docker; navegador 63/63 integrado ao frontend. Neon/R2 não acessados. Arquivos: `src/comum/dto.ts`,
`src/corretores/corretores.dto.ts`, `src/imoveis/imoveis.dto.ts`, `src/imoveis/imoveis.service.ts`,
`src/comissoes/comissoes.{controller,dto,service}.ts`, `corretor-spec.json`, docs. Próximo passo: revisão do dono e,
se autorizado, publicar a API antes do frontend. Detalhes: `2026-10-09-seis-pontos.md`.

## 2026-10-06 — Codex: upload e leitura da foto do perfil

Contrato aditivo local: PATCH JSON/multipart e GET público /corretores/:id/foto. Cliente R2 e quota
de recepção compartilhados com imóveis; validação de sessão/origem/arquivo, transação curta,
compensação e limpeza segura. url_foto e schema mantidos. URL gerenciada antiga rejeitada com 409.

Typecheck, lint e build aprovados. Jest com passWithNoTests confirma ausência de fontes, não cobertura.
22 cenários HTTP efêmeros com controllers/services reais e banco/R2/auth simulados, mais concorrência
de foto, aprovados. Frontend integrado em QA Chrome simulado; 23 cenários e 32 capturas.
R2 real: objeto isolado enviado, lido e apagado; GET após exclusão retorna 404. Sem gravar avatar no Neon;
login/DB/storage juntos e dispositivo físico permanecem sem homologação.

Contrato em `2026-10-06-foto-perfil.md`; System Design no frontend irmão, seis páginas inspecionadas.
Preexistentes staged/untracked de catálogo e documentação preservados. Sem novas dependências,
schema, migrations, commit, push ou deploy.

## 2026-10-04 — Padronização e centralização plana da documentação em docs/ (Antigravity)

Área assumida: documentação (`docs/`). Concluído.
- Centralização estrita em `docs/` em estrutura 100% plana, sem arquivos `.md` soltos na raiz e sem subpastas dentro de `docs/`.
- Removida pasta de configuração isolada de agentes `.claude/`.
- Registrada regra oficial no topo de `docs/DECISIONS.md`.
- Atualizadas referências internas dos agentes em `docs/AGENTS.md` e `docs/CLAUDE.md`.
- Limpeza e reestruturação de `docs/TASKS.md` em duas seções focadas: "Pendências Operacionais e Lançamento" e "Sugestões de Melhorias e Backlog Futuro".
- Validação: `npm run typecheck` e `npm run lint` aprovados (0 erros, 0 avisos).

## 2026-10-04 — Melhorias na listagem interna de imóveis e mensagens de erro de contrato

Área assumida: `imoveis` e `locacoes`. Concluído.
- `src/imoveis/imoveis.service.ts`: definido `ativo = true` como padrão na listagem interna (`listar_internos` / `GET /admin/imoveis`) quando `consulta.ativo` for `undefined`. Apenas traz inativos se `consulta.ativo === false` for passado explicitamente.
- `src/imoveis/imoveis.dto.ts` e `src/imoveis/imoveis.service.ts`: adicionados parâmetros opcionais `sem_contrato_ativo: boolean` e `apenas_disponiveis: boolean` em `ConsultaInternaImoveisDto`, filtrando imóveis que não possuem contrato com `status = 'ATIVO'` (`NOT EXISTS (SELECT 1 FROM contrato c WHERE c.imovel_id = imovel.id AND c.status = 'ATIVO')`), viabilizando seleção em telas de novos contratos.
- `src/locacoes/locacoes.service.ts`: tratamento diferenciado no catch do código de erro PostgreSQL `23505` inspecionando `constraint`:
  - `contrato_numero_contrato_key` ou contendo `numero_contrato` -> `ConflictException("O número de contrato informado já está cadastrado.")`.
  - `unico_contrato_ativo_imovel` -> `ConflictException("Este imóvel já possui um contrato ativo em vigor. Encerre o contrato anterior antes de cadastrar um novo.")`.
  - Outras constraints mantêm a mensagem genérica.

Validação: `npm run typecheck`, `npm run lint` e `npm run build` aprovados (0 erros, 0 avisos).
Sem commit/push/deploy ou alterações em migrations/banco.

## 2026-10-03 — Remoção de testes por solicitação do dono

Removidos 28 arquivos `*.test.*`/`*.spec.*` desta API e 46 do frontend irmão. Código de produção preservado.
Nenhum teste foi executado após a remoção; os resultados abaixo e no histórico são da execução anterior.
Scripts e dependências de teste permanecem sem suítes fonte.

## 2026-10-03 — Codex: revisão das correções concluída localmente (sem commit)

Pedido do dono: revisar as correções baseadas na auditoria de 02/10 e melhorar o que estivesse inadequado.
Corrigidos vínculos legítimos no PATCH de contrato (A01), limite durante recepção multipart/concorrência e lock
fora de transação (A02), respostas obsoletas e refresh compartilhado (A04), preservação de características
sem ressuscitar vínculos removidos (A09) e busca telefônica com +55 (A10). Correções anteriores A05–A08 mantidas.

Validação: frontend typecheck/lint, 43 arquivos/231 testes, build e SEO smoke aprovados; API typecheck/lint,
27 suítes/188 testes e build aprovados, 1 suíte/4 testes PostgreSQL não executados. HTTP sintético cobre A01,
upload chunked agregado, autorização anterior ao storage, concorrência e limite de 20 arquivos. Sessões e
round-trip de características exercitados com persistência sintética. API lenta/recuperação e teto SSR testados.
Navegador local: catálogo, detalhe e 404; robots/sitemap por HTTP. Sem homologação de banco/Drive/R2 reais,
infra publicada ou testes de carga. A09/A10/A11/H01 conservam pendências operacionais no relatório.

Trabalho direto na main, HEADs sincronizados com origin/main após fetch (0/0 em ambos). Alterações locais
anteriores preservadas. Sem commit/push/deploy/migration ou escrita em serviços reais nesta revisão.
Relatório: docs/audits/2026-10-02-auditoria-fullstack.md no Corretor-web.


## 2026-10-03 — Codex: revisão das correções da auditoria (em andamento)

Área assumida: A01–A11 e documentação, por pedido do dono. Revisão e correções com testes locais/sintéticos; sem commit, deploy, migrations ou escrita em serviços reais. Alterações locais anteriores preservadas.


## 2026-10-02 — Limpeza de testes e documentos legados obsoletos

Área assumida: Limpeza e manutenção do repositório.
- Removidos testes legados e lentos: `src/bootstrap.spec.ts` (subprocessos lentos cobertos por specs unitárias), `src/cadastros/cadastros.http.spec.ts` (substituído por testes modulares de serviço) e `src/database/migracao-legado.spec.ts` (legado encerrado).
- Preservados os testes e arquivos dos últimos 3 commits (incluindo `src/database/modelo-portugues.integracao.spec.ts` e `src/commands/seed-demonstracao.ts`).
- Removidos documentos de planos antigos de fases anteriores (`docs/plans/2026-09-12-rental-administration.md`, `docs/handoffs/2026-09-12-plano-anterior-api.md`, `docs/plans/2026-09-13-backend-portugues.md`, `docs/handoffs/2026-09-11-infra-neon-r2.md`) e arquivos `.gitkeep` vazios.
- Linter configurado no script de seed com 0 erros e 0 avisos.
- Validação: `npm run lint` 0 erros, `npm run typecheck` 0 erros, `npm test` 24 suítes/175 testes aprovados em ~30s (0 falhas), `npm run build` 100% aprovado.



## 2026-10-02 — Resolução integral dos Gaps de Execução no Backend

Implementados e validados todos os gaps backend do "Plano de Resolução Integral dos Gaps de Execução":
- GAP-01 (A01): Validação estrita de autorização em `LocacoesService.validarContrato` — corretores não-ADMIN só vinculam pessoas da própria carteira ou de contratos previamente intermediados.
- GAP-02 (A02): Criado `PodeEditarImovelGuard` para rejeição antes da alocação de buffer pelo Multer, desacoplamento do envio R2/S3 da transação PostgreSQL com compensação e exclusão direta no R2 sem download em memória.
- GAP-03 (A03): Revogação atômica de sessões de login em `CorretoresService.atualizar` no reset de senha ou desativação pelo ADMIN.
- GAP-04 (A09): Ficha interna de imóveis expõe características inativas com anotação `caracteristica_ativa`, preservando vínculos históricos no update.
- GAP-05 (A10): Busca de telefone em `PessoasService.listar` normalizada com `regexp_replace` para pesquisa por dígitos limpos.
- GAP-09: Resiliência de cold start Neon em `database.config.ts` (3 retryAttempts, 15s timeout).
- GAP-10: Reset do rate limiter em `TentativasGuard` após autenticação com sucesso.
- GAP-11 (OPS-001): Limpeza inicial de sessões expiradas no `onModuleInit` de `SessoesService`.

Validação completa:
- `npm run typecheck`: aprovado (0 erros).
- `npx eslint`: aprovado em todos os módulos modificados (0 erros).
- `npm test`: 26 suítes / 180 testes aprovados (+ 6 novos testes em `pode-editar-imovel.guard.spec.ts`, totalizando 41 testes nas suítes modificadas).
- `npm run build`: aprovado (build de produção NestJS).
- Nenhuma migration alterada ou criada. Banco Neon preservado intacto.

## 2026-09-17 — Claude: banco Neon zerado e contrato v2 aplicado do zero

Área assumida: banco de dados do Neon (`corretor-db`) e validação de build/execução local. Concluído.

Autorização explícita do dono para zerar o banco. Backup integral em JSON feito antes
(`backups/backup_pre_zerar_202609170236.json`, 21 linhas, fora do Git), porque o `pg_dump` via Docker do
`AGENTS.md` não roda nesta máquina (Docker não instalado).

**Correção de registro importante:** ao contrário do que os documentos anteriores afirmavam, a migration
`1789516800000-modelo-portugues` **já estava aplicada no Neon** antes desta sessão. O banco não estava vazio.

Estado do banco agora: schemas `public` (contrato v2, 14 tabelas, ids `integer`, tabela `pessoas`),
`legado_20260913` e `legado_20260916` vazios. `typeorm_migrations` com as **10 migrations** registradas.
Seeds: 5 tipos de imóvel e 3 finalidades. Administrador recriado com id `1` e a senha de `BOOTSTRAP_ADMIN_PASSWORD`
— **ADMIN-002 destravado**, login verificado com resposta 200.

Validação: typecheck, lint, build e 26 suítes/175 testes aprovados (1 suíte/4 testes de integração ignorados por
exigirem PostgreSQL local). API executada de fato a partir de `dist/main.js` contra o Neon novo:
`GET /api/v1/saude` 200, `GET /api/v1/imoveis` 200 vazio, `POST /api/v1/autenticacao/entrar` 200 com token.

Próximo passo: usar o ambiente local para testar o sistema. O Render não é bloqueio — o dono informou em 17/09 que
ainda não o usa; quando for publicar, subir o código v2 junto com o front e apontar o health check para
`/api/v1/saude`. Pendências menores: CPF de exemplo do administrador e `BOOTSTRAP_ADMIN_*` ainda no `.env`.

## 2026-09-16 — Claude: ids inteiros, pessoas unificadas e ficha do imóvel

Área assumida: contrato v2 descrito em `../Corretor-web/docs/specs/2026-09-16-ids-inteiros-pessoas.md`.
Todas as tabelas passam a id inteiro; `clientes` e `partes_locacao` viram `pessoas`; imóvel ganha
dois valores, proprietário, exclusividade, captação, chaves, destaque e status final; catálogo ganha
bairro, área, ordenação e busca por id. Migration nova aditiva; nenhuma migration aplicada é editada;
nenhuma execução automática. Regras de locação e comissão preservadas. Código concluído e validado
(typecheck, lint, 175 testes; integração da migration em PostgreSQL 16 via Docker aprovada). Aguarda o front v2
e o corte coordenado. Sem commit/push.

## 2026-09-16 — Render recuperado após correção de ALLOWED_ORIGINS

Atualizada no serviço Render `Corretor-API` a variável não secreta `ALLOWED_ORIGINS` para
`https://corretor-web-test.vercel.app`. O deploy `dep-dal39v2d0e5s738d6vng`, no commit
`896c39c`, ficou `live`. Verificação externa: `GET /api/v1/saude` respondeu 200 e o
preflight CORS da origem autorizada respondeu 204 com credenciais.

## 2026-09-16 — Codex: correção de achados de segurança da auditoria

Área assumida: autorização de cadastros, invalidação de sessões após troca de senha e CORS seguro.
Sem alteração de dados, migrations aplicadas, infraestrutura ou segredos. Validação concluída:
typecheck, lint, build, 6 suítes/52 testes aprovados (1 suíte/4 testes integrados opcionais
ignorados) e `git diff --check`. Rate limit distribuído e `trust proxy` exigem infraestrutura/
topologia; exposição de dados já possui restrições no código atual.


> Estado vigente: registro de 14/09/2026 ao final e `docs/handoffs/2026-09-14-backend-portugues.md`. Os registros anteriores são históricos; prevalece o pedido integral de 13/09/2026.

Atualizado em: 2026-09-12
Agente responsável: Claude (sessão de ambiente de desenvolvimento e limpeza de dados fixos)
Commit da `main`: `a41f49b` — "crente - task: secure frontend API integration"
Repositório irmão: corretor-web, `main` em `d4f6b2f` ("feat: add complete SEO and SSR delivery")

## Em andamento

- **ADMIN-002 — acesso ao painel bloqueado.** A senha do único administrador não confere com o hash do banco;
  aguardando o dono escolher a senha nova para a redefinição.
- Ambiente de desenvolvimento no ar: API em `http://localhost:3000` (conectada ao Neon) e front SSR em
  `http://127.0.0.1:5173`, com o proxy `/api` funcionando.
- Pesquisa de deploy (Render e Vercel) iniciada pelo Claude; resultado ainda não incorporado às tarefas.

## Concluído recentemente

- **Ambiente de desenvolvimento levantado e verificado (12/09/2026).** `npm test` com 13 suítes e 130 testes
  aprovados, lint, typecheck e build sem erro. A API subiu, conectou ao Neon e respondeu: `GET /properties` 200,
  `GET /auth/me` e `GET /agents` 401 sem token, rota inexistente 404. O front subiu e o proxy `/api/properties`
  respondeu 200 através dele.
- **Dados de teste da homologação removidos (12/09/2026).** Backup `backups/backup_20260912_0908.sql` gerado antes.
  Apagadas as 2 linhas de `refresh_sessions` dos logins de 11/09 e o objeto `_amostra/teste-navegador.png` do bucket
  R2, que agora está vazio. O banco segue com 1 administrador e nenhum imóvel, mídia ou lead.
- **Limpeza de dados fixos no repositório irmão (12/09/2026).** O modo demonstração foi removido por inteiro do
  corretor-web e a identidade do site foi centralizada em `src/config/brand.ts`. Detalhes no `CHANGELOG_AI.md` de lá.

- **Infraestrutura externa criada e homologada (11/09/2026).**
  - Neon: projeto com banco `corretor-db`, PostgreSQL 16.15, região `aws-sa-east-1` (São Paulo), conexão direta (sem pooler).
  - As 5 migrations foram aplicadas: `agents`, `properties`, `property_media`, `leads`, `refresh_sessions`.
  - Cloudflare R2: bucket `corretor-midia`, URL pública de desenvolvimento ativa e token com permissão Object Read & Write restrita ao bucket.
  - Primeiro ADMIN criado pelo `npm run bootstrap:admin`: id `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f`. As variáveis `BOOTSTRAP_*` foram removidas do `.env`.
  - Dois backups em `backups/` (após as migrations e após a homologação).
- **Teste ponta a ponta com Neon e R2 reais: 25 passos, todos aprovados.** Cobriu login com cookie de refresh,
  recusa de origem não autorizada (403), CRUD de imóvel, upload de 3 imagens ao R2, leitura pública, capa,
  exclusão com remoção no R2, detalhe público, página SSR do front com JSON-LD e `og:image`, lead recusado sem
  consentimento (400) e aceito com consentimento (201), e limpeza completa dos dados de teste.
- **Verificação local:** 13 suítes e 130 testes aprovados; lint, typecheck e build sem erro.

## Bloqueios

- **O commit `accd5d9` ("segurança e operações") não existe no GitHub nem nesta máquina.** Foi procurado em `main`,
  `shura`, commits soltos, stash, reflog, tags, forks e PRs. Ele contém, segundo o parecer da sessão anterior:
  Helmet, health check, rate limit de leads, criptografia AES-256-GCM dos dados pessoais de leads, filtro global
  de exceções, compatibilidade com o prefixo `/api/v1` e transações nas operações de mídia. Nada disso está no
  código publicado. Só o autor (SHURIKA6) pode recuperá-lo com um push.
- Sem esse commit, a API não tem rota de health nem filtro global de exceções, o que afeta o deploy no Render.
- O WhatsApp do administrador criado ficou com o número de exemplo `5565999999999` e precisa ser corrigido no painel.
  Depende de ADMIN-002 (sem acesso ao painel) e do número real, que só o dono tem.
- **A senha do administrador não confere com o hash do banco.** `POST /auth/login` responde 401 com o valor que está
  em `BOOTSTRAP_ADMIN_PASSWORD`. Sem redefinir, não há acesso ao painel — só o catálogo público funciona. Ver ADMIN-002.
- **As variáveis `BOOTSTRAP_*` voltaram ao `.env`** e o `.env.example` versionado foi sobrescrito, perdendo os
  comentários. Contraria a decisão de 11/09; o `.env.example` aparece como modificado e não commitado no Git.

## Próximo passo

Destravar ADMIN-002 (redefinir a senha do administrador) para poder testar o painel ponta a ponta. Em seguida,
corrigir o WhatsApp (ADMIN-001) e retomar a decisão de publicação da API, considerando cold start, ausência de rota
de health e a latência entre a API nos EUA e o Neon em São Paulo. Detalhes e tarefas em `TASKS.md`.

## Arquivos modificados recentemente

Nenhum arquivo de código da API foi alterado nesta sessão. Alterados apenas os arquivos de contexto
(`PROJECT_STATUS.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG_AI.md`). O `.env.example` aparece modificado no Git
desde antes desta sessão, por alteração de terceiro — ver Bloqueios.

## Estado dos serviços externos

| Serviço | Estado | Detalhe |
|---|---|---|
| Neon | ativo | 1 admin, nenhum imóvel, mídia, lead ou sessão. Suspende após 5 min de inatividade; free tier de 0,5 GB por projeto |
| Cloudflare R2 | ativo | bucket **vazio**: a imagem de amostra em `_amostra/` foi apagada em 12/09 |
| Render | não criado | — |
| Vercel | não criado | — |

## 2026-09-12 — Codex: administração de locações em implementação

Área assumida: cadastros, contratos e documentos privados (ADMIN). Comissão de captação parcelada iniciada em `src/finance/`, sem SI9/Imonov. Alterações preexistentes preservadas; sem commit/push e sem mudança automática do banco real.


## 2026-09-13 — Codex: URLs em português
Área assumida: rotas do front, compatibilidade e SEO; implementação do plano aprovado em andamento. API sem mudanças de contrato.


## 2026-09-13 — Codex: URLs em português concluídas
Rotas públicas: /imoveis/{tipo}, /imoveis/para-alugar, /imoveis/para-comprar e combinações; query cidade/preco-minimo/preco-maximo/pagina. Painel: /admin/entrar e /admin/contatos. URLs antigas redirecionam 301; navegador usa replace; slugs e APIs preservados.
Publicação Vercel dpl_Bbf5617bGJdqKv79WJbuDDFJaP1M READY, alias https://corretor-web-test.vercel.app. SITE_URL e SEO_INDEXABLE configuradas em Production conforme autorização. Robots, llms e sitemap respondem 200; raiz index,follow; filtros noindex,follow; painel noindex,nofollow. Sitemap contém início e privacidade (catálogo público sem imóveis no momento).
Validação: typecheck, lint, build, suíte de 93 testes e teste adicional de navegação aprovado (94 no total coberto); smoke SSR/proxy/discovery aprovado. Navegador: redirecionamento, paginação e detalhe com fixture local; catálogo filtrado publicado confirmado. Login autenticado/logout e fichas reais não exercitados no navegador nesta sessão; permissões existentes cobertas pela suíte. Sem commit/push.


## 2026-09-13 — Preparação de commit e push autorizada
Codex: revisão do diff concluída; typecheck, lint, 21 arquivos/94 testes, build e smoke de SEO aprovados novamente. Front: código e documentação das URLs; API: somente documentação correspondente. Alterações anteriores da API em .env.example e .gitignore excluídas do commit.


## 2026-09-13 — Codex: investigação de upload de mídia
Logs do Render para o POST de mídia registram `write EPROTO ... SSL alert handshake failure` no processo da API. O erro acontece durante `PutObject` no cliente S3, antes de persistir `property_media`; credenciais inválidas produziriam resposta HTTP 4xx, portanto o próximo passo é corrigir/verificar `R2_ENDPOINT` TLS no ambiente Render (endpoint S3 HTTPS da conta, sem bucket no caminho) e repetir o upload.
Área assumida: erro HTTP 500 ao enviar mídia no ambiente corretor-web-test; rastrear proxy, API e R2. Em andamento.


## 2026-09-13 — Codex: diagnóstico NoSuchBucket
Conta Cloudflare conectada consultada: corretor-documentos-test existe; corretor-midia ausente. Código de mídia usa corretor-midia fixo; documentos usam R2_DOCUMENTS_BUCKET. Render Corretor-API confirmado no workspace autorizado. Pendente conferir R2_ENDPOINT implantado: conector disponível não retorna variáveis. Sem alteração de infraestrutura ou código; ausência do bucket explica upload de fotos se endpoint aponta para essa conta.


## 2026-09-13 — Codex: correção da infraestrutura de mídia em andamento
Criado corretor-midia na conta confirmada pelo endpoint informado. R2_PUBLIC_URL atualizado no Render para https://pub-64e891dc485143119f5d8fddfa8280be.r2.dev; deploy dep-dajfg6gjo6nc73dlrs10 iniciado automaticamente. Na verificação, corretor-documentos-test tinha r2.dev público ativo; desativado para restaurar privacidade exigida pelo projeto. Credenciais S3 preservadas; validação de upload autenticado pendente.


## 2026-09-13 — Codex: mídia R2 provisionada
Deploy dep-dajfg6gjo6nc73dlrs10 LIVE; health da API HTTP 200. Escrita de objeto temporário pelo conector Cloudflare, leitura pública HTTP 200 e exclusão aprovadas. Documentos com r2.dev desativado e sem domínios personalizados. Falta repetir upload autenticado no painel para confirmar permissões das credenciais S3 do Render, que não foram acessadas nem alteradas.


## 2026-09-13 — opencode: capa na listagem pública (implementado, sem commit)
Área assumida: capa some no catálogo (`media: []` na listagem) embora apareça no detalhe. Causa: `PropertiesService.list()` carregava só `agent`, sem `media`. Correção sem migration e sem mudar contrato: segunda query por `propertyId` (`In`, ordenada) anexada antes de `toPropertyResponse`, preservando a paginação. `MediaRepositoryFixture` passou a entender o operador `In`. Typecheck, lint e 18 suítes/191 testes aprovados (inclui teste novo de capa ordenada na listagem). Sem commit/push (aguardando confirmação do dono); deploy no Render pendente para o catálogo publicado refletir a correção.

## 2026-09-13 — opencode: perfil próprio, senha e filtro de status (implementado, sem commit)
Área assumida: PATCH /auth/me, PATCH /auth/me/password e status? no gerenciado, a pedido do dono (inclui front no repositório irmão). Sem migration e sem mudança no contrato público. Typecheck, lint e 18 suítes/195 testes aprovados. Sem commit/push (aguardando confirmação do dono); deploy no Render pendente. Troca/reset não revoga outras sessões (decisão em DECISIONS.md).
Commit a6026d3 na main, push c404f6e..a6026d3 main -> main.

## 2026-09-13 — Codex: refatoração integral do backend em andamento
Área assumida: modelo português, migração, autenticação, catálogo, clientes, contratos/Drive e comissões. Plano: docs/plans/2026-09-13-backend-portugues.md. Agentes divididos por domínio, documentação centralizada no Codex principal. Pedido atual substitui regras conflitantes do MVP anterior. Sem commit/push/deploy ou mutação no Neon nesta implementação.

## 2026-09-14 — Codex: backend integral implementado e validado

Estado: código concluído; homologação isolada concluída; sem commit/push/deploy. Novo domínio: autenticacao, corretores, cadastros, imoveis, midias, clientes, locacoes, comissoes, drive, comum e saude. Migrations históricas preservadas; nova 1789516800000 converte e arquiva legado, sem inventar dados. Logger/CLI impedem exposição de dados decifrados. Retirados runtime/telas API antigas de documentos privados e pagamentos/repasse mensal.

Verificação final: npm run typecheck, npm run lint, npm run build — aprovados. npm test — 26 suítes/169 testes aprovados; 4 testes de integração ficam opcionais no comando local e foram executados separadamente com sucesso (1 suíte) usando HOMOLOGACAO_DATABASE_URL na database vazia homologacao_pt, branch Neon br-ancient-sound-a5tsf5rf, PostgreSQL 16.15/TLS. Conversão de IDs/hashes/cifras/tags, constraints/FKs/índice parcial e HTTP completo de saúde/login/catálogo/clientes/comissões/baixa aprovados; transação revertida ao final.

Revisão independente corrigida: logging forçado da CLI TypeORM (substituída por executor sanitizado) e suporte a clientes manuais para comissões legadas sem lead. Nenhum segredo no Git ou nos registros. Documentação de ambos repositórios atualizada sem apagar histórico.

Pendências externas: credenciais/IDs e homologação real Workspace, upload novo com R2 real, complementos/backup/corte do banco publicado e adaptação frontend/SSR. Banco principal e serviços publicados não alterados. A branch de homologação foi mantida para revisão; definir sua retenção após aceite. Git permanece main; estado inicial sincronizado com origin/main, sem alterações preexistentes de código da API.

## 14/09/2026 — frontend do modelo português em execução
Codex concluiu API-PT-002 no frontend irmão: painel, serviços, SSR, classificações dinâmicas, mídia, clientes, contratos e comissões integrados ao contrato português. Drive externo será configurado pelo dono. API permanece validada com typecheck, lint e testes.


## 2026-09-16 — Pacote de melhorias do frontend irmão

Codex concluiu melhorias públicas e administrativas em Corretor-web, reutilizando os contratos atuais de
imóveis/clientes/contratos/comissões. Nenhum código, DTO, dependência, migration ou dado desta API foi alterado.
Dashboard percorre todas as páginas de comissões; contatos usam imovel_id/criado_desde/criado_ate. Origem é somente
informativa porque ConsultaClientesDto não aceita esse filtro; ordenação adiada. Duplicação usa POST existente e slug novo.
Validação frontend e limites de homologação registrados no CHANGELOG_AI.md do Corretor-web; testes desta API não foram
reexecutados neste corte exclusivamente documental. Sem commit/push/deploy.


## 2026-09-20 — Claude: 404 na ficha pública de imóvel criado — corrigido (sem commit)

Área assumida: `src/imoveis`. Nenhum outro agente estava na mesma área.

Causa: `ImoveisService.criar` reservava o id com `nextval` e o TypeORM descarta id explícito em coluna
`@PrimaryGeneratedColumn`; o identity do banco gerava outro id e o slug ficava apontando para o id anterior.
Correção: insert sem id, slug definitivo gravado depois com o id real, e `atualizar` recalculando o slug sempre.

Arquivos tocados: `src/imoveis/imoveis.service.ts`, `src/imoveis/imoveis.service.spec.ts`,
`src/database/modelo-portugues.integracao.spec.ts`, `DECISIONS.md`, `CHANGELOG_AI.md`, `TASKS.md`,
`PROJECT_STATUS.md`.

Estado: typecheck, lint, build e `npm test` (26 suítes/176 testes) aprovados; verificação HTTP real contra o Neon
aprovada. Banco: imóvel 2 reparado, imóveis 4/6/8/10 (duplicatas) e 11/12 (verificação) apagados após backup em
`backups/backup_pre_limpeza_imoveis_202609201926.json`. Sem migration, sem variável nova, sem dependência nova.

Bloqueios e próximo passo: a API que o dono deixou rodando na porta 3000 ainda serve o código antigo — reiniciar.
Teste de integração novo não executado por falta de PostgreSQL de homologação. Sem commit/push/deploy.
