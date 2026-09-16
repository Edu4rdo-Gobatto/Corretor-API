# Histórico de trabalho dos agentes — corretor-api

## 2026-09-16 — Claude — ids inteiros, pessoas unificadas e ficha do imóvel (contrato v2)

Pedido do dono: abandonar UUID em favor de id inteiro com autoincremento, unificar o cadastro de pessoas
(lead, cliente, proprietário e inquilino são a mesma pessoa), ampliar a ficha do imóvel com campos opcionais
e dar filtros/ordenação ao catálogo. Contrato: `docs/handoffs/2026-09-16-ids-inteiros-pessoas.md`.

Alterações:

- `src/comum/`: `auditoria.entity.ts` e `usuario-autenticado.ts` com ids inteiros; `dto.ts` (novo) com
  `IdRegistro` e transformações compartilhadas; `datas.ts` (novo) com `DATA_ATUAL_SQL`/`hojeCivil`.
- `src/pessoas/` (novo módulo) substitui `src/clientes/` e `parte-locacao.entity.ts`: entidade `Pessoa`
  com `status_contato`, dados bancários e documento opcionais; rotas `POST /pessoas` (público) e
  `/admin/pessoas`; visibilidade por responsável ou contrato intermediado; IP do consentimento fora da resposta.
- `src/imoveis/`: entidade com `valor_venda`/`valor_locacao`, status `VENDIDO|ALUGADO|RETIRADO`,
  `destaque` e ficha interna; DTOs com `bairro`, `area_min/max`, `destaque`, `ordenar`, `id`; serviço com
  QueryBuilder (busca por id com `#`, preço pela finalidade, ordenação com nulos por último), slug com id
  recalculado ao renomear, detalhe público pelo id do slug; resposta pública separada da interna.
- `src/locacoes/`: contratos apontam para `pessoas`; controlador de partes removido; resposta inclui
  `imovel_titulo`, `locador_nome`, `locatario_nome`; filtro `pessoa_id`; `DELETE` 204.
- `src/comissoes/`: `cliente_id` → `pessoa_id`; `total_paginas` na listagem; `DELETE` 204.
- `src/autenticacao/`, `src/corretores/`, `src/cadastros/`, `src/midias/`, `src/drive/`: ids inteiros,
  `ParseIntPipe`, `sub` do JWT como texto numérico.
- `src/database/migrations/1789603200000-ids-inteiros-pessoas.ts` (nova) e `registros.ts`;
  `migracao-legado.ts` ganhou DTO próprio do legado no lugar do `ClienteManualDto` removido.
- Testes: specs de pessoas (novos), imóveis, locações, comissões, autenticação, cadastros, mídia, drive e
  corretores atualizados; `modelo-portugues.integracao.spec.ts` agora roda também a migration nova e aceita
  `TESTE_LOCAL_DATABASE_URL` (PostgreSQL local sem TLS, por exemplo Docker) além de `HOMOLOGACAO_DATABASE_URL`.

Testes executados (resultado real):

- `npm run typecheck`: sem erros. `npm run lint`: sem erros.
- `npm test`: 26 suítes, 175 testes aprovados; 1 suíte (4 testes) de integração ignorada sem banco.
- Integração com Docker `postgres:16` (`TESTE_LOCAL_DATABASE_URL=postgresql://teste:teste@127.0.0.1:55432/corretor_teste
  npx jest src/database/modelo-portugues.integracao.spec.ts`): 4 testes aprovados — migrations legadas +
  1789516800000 + 1789603200000 com dados sintéticos cifrados, constraints, schema legado e fluxo HTTP
  (login, catálogo ordenado, pessoas, ficha do imóvel, slug renomeado, comissão e baixa de parcela).
- Não executado: `npm run build` desta rodada; homologação em Neon; deploy.

Pendências e riscos: publicação exige o front v2 (a API nova quebra o contrato antigo); migração do banco
publicado só com backup e corte coordenado; documentação antiga (README, ENTENDENDO-O-BACKEND, spec de
13/09) ainda cita clientes/partes/UUID (DOC-003); aviso de novo contato (NOTIFY-001) e regras de locação
(RENTAL-004) ficaram para conversa com o dono. Sem commit/push.

## 2026-09-13 — opencode — perfil próprio, senha e filtro de status no gerenciado

Pedido do dono: página `/admin/perfil` no front com foto grande, métricas por status e edição dos próprios
dados, troca da própria senha no perfil e botão de redefinição de senha pelo ADMIN com a senha escolhida na hora.

Alterações (sem migration, sem mudar contrato público):

- `src/properties/dto/property-query.dto.ts` + `properties.service.ts`: `status?` opcional no
  `ManagedPropertyQueryDto`, aplicado ao `where` do `listManaged`. O público (`PropertyQueryDto`) rejeita
  `status` com 400, como antes rejeitava qualquer campo fora da lista.
- `src/agents/dto/update-profile.dto.ts` (novo): só `name`, `whatsappNumber`, `creci?`, `avatarUrl?`.
  E-mail, papel, senha e ativo ficam de fora de propósito.
- `src/agents/dto/change-password.dto.ts` (novo): `currentPassword` + `newPassword` (12–128, sem só-espaço).
- `src/agents/agents.service.ts`: `updateProfile(id, dto)` (só conta ativa) e `changePassword(id, dto)`
  (verifica a atual com argon2, `401 'Senha atual incorreta.'` se não confere).
- `src/auth/auth.controller.ts`: `PATCH /auth/me` e `PATCH /auth/me/password`, só `JwtAuthGuard`, id sempre
  do próprio `viewer`. O reset pelo ADMIN usa o `PATCH /agents/:id` existente — sem código novo.
- Testes: filtro por status + 400 para status inválido no público e no gerenciado (`properties.http.spec.ts`);
  edição própria com 400 para `email`/`role` e 401 sem token, troca com login novo válido e antigo rejeitado,
  senha atual errada 401 e nova curta 400 (`auth.http.spec.ts`).

Verificação (resultado real): `npm run typecheck` aprovado; `npm run lint` aprovado;
`npm test` com 18 suítes e 195 testes aprovados.

Risco/pendência: sem commit/push (aguardando confirmação do dono, direto na `main` quando liberado);
troca/reset de senha não revoga outras sessões — o token atual do alvo segue válido até expirar
(decisão registrada em `DECISIONS.md`); deploy no Render pendente para o front usar os endpoints novos.

## 2026-09-13 — Codex — comissão de captação parcelada

Criado `src/finance/` com comissão de captação equivalente ao aluguel do contrato, parcelamento de 1 a 60 parcelas, distribuição decimal exata dos centavos, vencimentos mensais, saldo pago/pendente e confirmação manual de cada parcela. Rotas ADMIN: `GET /admin/finance/commissions/lease/:leaseId`, `POST /admin/finance/commissions` e `PATCH /admin/finance/commissions/installments/:id/paid`. Migration aditiva `1789344000000-create-acquisition-commissions.ts` registrada no data-source. SI9/Imonov não participa.

Verificação: typecheck, lint, build e 18 suítes/190 testes aprovados. A migration não foi aplicada ao Neon e não há integração bancária nesta etapa.

## 2026-09-12 — Codex — primeira entrega de administração de locações

Tarefa: RENTAL-001. Criado o módulo `src/rentals/` com cadastros PF/PJ de proprietários e inquilinos, dados privados cifrados, contratos, regras de datas/valores/partes, documentos em bucket R2 privado e downloads autenticados. Todas as rotas exigem JWT + papel ADMIN; documentos rejeitam tipos/tamanhos/assinaturas inválidos e não expõem `storageKey`, bucket ou URL pública. A migration `1789257600000-create-rental-administration.ts` é aditiva e foi registrada no data-source sem execução automática.

Também foi adicionada busca parcial de imóveis somente no DTO administrativo, impedida a exclusão de imóvel com vínculos e corrigido o formato de mensagens do filtro global para compatibilidade com o cliente. Um contrato antigo pode ser encerrado depois de o imóvel mudar para venda.

Verificação real: `npm run typecheck`, `npm run lint`, `npm test` (18 suítes, 190 testes) e `npm run build` passaram. Testes cobrem regras de domínio, upload compensado, criptografia, permissões, cabeçalhos de download e busca administrativa.

Pendências: backup e aplicação explícita da migration no Neon, provisionamento/configuração do bucket privado e homologação com dados reais. A regra de comissão ainda não foi definida; financeiro, cobranças, repasses e integração SI9/Imonov continuam fora desta entrega.

Registro objetivo, do mais recente para o mais antigo. Cada entrada traz tarefa, alterações,
testes com resultado real e pendências.

## 2026-09-12 — Claude (ambiente de desenvolvimento e limpeza de dados fixos)

Tarefa: subir a API em desenvolvimento, testar, e limpar os dados fixos a pedido do dono do projeto.

Alterações em código da API: nenhuma. Alterados apenas os arquivos de contexto
(`PROJECT_STATUS.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG_AI.md`).

Ações fora do repositório:

- Backup do banco antes de qualquer escrita: `backups/backup_20260912_0908.sql` (`pg_dump` 16 via Docker).
- `DELETE` das 2 linhas de `refresh_sessions` deixadas pelos logins de homologação de 11/09. Tabela agora vazia.
- Objeto `_amostra/teste-navegador.png` removido do bucket R2 `corretor-midia`, que ficou vazio.
- Trabalho no repositório irmão corretor-web: remoção completa do modo demonstração e centralização da identidade
  em `src/config/brand.ts`. Registrado no `CHANGELOG_AI.md` de lá.

Testes executados:

- `npm test`: 13 suítes, 130 testes aprovados.
- `npm run lint` e `npm run typecheck`: sem erro.
- `npm run start:dev`: a API subiu, conectou ao Neon (TypeORM em ~2 s) e mapeou as 20 rotas.
- Verificação HTTP com a API no ar: `GET /properties` 200 com página vazia; `GET /properties?page=1&limit=5` 200
  respeitando o `limit`; `GET /auth/me` e `GET /agents` 401 sem token; `GET /` 404.
- `POST /auth/login` com as credenciais do `.env`: **401**. Ver Achados.
- Integração com o front: `GET /api/properties` pelo proxy do SSR respondeu 200 com o mesmo corpo da API.

Achados:

- **O login do administrador está quebrado.** O e-mail de `BOOTSTRAP_ADMIN_EMAIL` confere com o do banco, mas a senha
  não: `POST /auth/login` responde 401. O hash Argon2id gravado em 11/09 não corresponde ao valor atual de
  `BOOTSTRAP_ADMIN_PASSWORD`. Como o hash é de mão única, a senha original não é recuperável. Aberta a tarefa
  ADMIN-002 para redefinir. **Sem isso, o painel não abre** — só o catálogo público funciona.
- **As quatro variáveis `BOOTSTRAP_*` voltaram ao `.env`**, com a senha em texto claro, contrariando a decisão de
  11/09 — e a senha ali nem é válida. O `.env.example` versionado também foi sobrescrito com essa estrutura e perdeu
  os comentários que documentavam cada campo; aparece como modificado e não commitado no Git. Não foi alterado nesta
  sessão porque o dono não incluiu esse item no escopo da limpeza que pediu.
- O WhatsApp do administrador no banco continua `5565999999999`, o número de exemplo (ADMIN-001). A correção depende
  do acesso ao painel e do número real.
- O código da API não tem dado fixo de produto: os telefones e e-mails de exemplo estão só em `*.spec.ts` e em
  `src/testing/`, que é onde devem ficar. O nome do bucket `corretor-midia` é fixo em `src/media/media.service.ts`
  por decisão de 11/09, e o fallback `http://localhost:5173` de `ALLOWED_ORIGINS` só vale em desenvolvimento.
- O driver `pg` emite aviso de que `sslmode=require` passará a ter semântica libpq em versão futura. Não afeta a
  aplicação hoje (a validação de ambiente já exige TLS verificado), mas vale acompanhar na atualização do `pg`.

Pendências:

- ADMIN-002: redefinir a senha do administrador. Aguardando a senha escolhida pelo dono.
- ADMIN-001: WhatsApp real do administrador.
- Limpar as `BOOTSTRAP_*` do `.env` e restaurar o `.env.example` com os comentários — fora do escopo pedido, mas
  recomendado; está registrado em `DECISIONS.md`.
- OPS-001: a limpeza de sessões continua manual; a rotina ainda não existe.
- SEC-001 e DEPLOY-001 seguem como estavam.

Sem cobertura de teste: a redefinição de senha (ainda não implementada) e o fluxo autenticado ponta a ponta com o
banco real, que não pôde ser reexecutado por causa do login bloqueado.

## 2026-09-11 — Claude (infraestrutura e homologação)

Tarefa: INFRA-001 — criar e homologar Neon e Cloudflare R2; conferir o parecer da sessão anterior contra o repositório.

Alterações em código: nenhuma. Alterações em arquivos versionados: criação da camada de contexto
(`AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `DECISIONS.md`, `TASKS.md`, `CHANGELOG_AI.md`, `docs/handoffs/`).

Ações fora do repositório:

- `.env` local preenchido com Neon e R2; `JWT_SECRET` gerado; `DATABASE_URL` duplicado corrigido; permissão `600`.
- 5 migrations aplicadas no Neon (`migration:run`), criando 6 tabelas com a de controle.
- Primeiro ADMIN criado (`bootstrap:admin`), id `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f`; variáveis `BOOTSTRAP_*` removidas do `.env`.
- Dois backups gerados em `backups/` com `pg_dump` 16 via Docker (após migrations e após homologação).

Testes executados:

- `npm ci`: ok, 0 vulnerabilidades.
- `npm test`: 13 suítes, 130 testes aprovados.
- `npm run lint`, `npm run typecheck`, `npm run build`: sem erro.
- Teste ponta a ponta com Neon e R2 reais, pelo proxy do front: 25 passos aprovados, cobrindo login com cookie de
  refresh, recusa de origem não autorizada (403), criação de imóvel, upload de 3 imagens ao R2 com leitura pública,
  definição de capa, exclusão com remoção do objeto no R2, detalhe público, página SSR com JSON-LD e `og:image`,
  lead sem consentimento (400) e com consentimento (201), e limpeza completa.

Achados:

- O commit `accd5d9` citado no parecer anterior **não existe** no GitHub nem nesta máquina; foi procurado em `main`,
  `shura`, commits soltos, stash, reflog, tags, forks e PRs. As funcionalidades de segurança que ele traria não estão no código.
- A API tem 130 testes, não os 144 citados no parecer.
- A Cloudflare responde 403 ao User-Agent `Python-urllib` na URL pública do R2. Não é configuração do bucket:
  com Node, curl ou navegador a mesma URL responde 200.
- `pg_dump` e `psql` não estão instalados na máquina; usamos a imagem Docker `postgres:16`.

Pendências:

- SEC-001: recuperar o `accd5d9` com o autor.
- ADMIN-001: o WhatsApp do administrador ficou com o número de exemplo.
- DEPLOY-001: publicação ainda não iniciada; pesquisa de Render e Vercel em andamento.
- Ficaram duas sessões de refresh dos logins de teste na tabela `refresh_sessions`; expiram em 30 dias (OPS-001).

## 2026-09-11 — Claude (análise do repositório)

Tarefa: mapear o que está implementado e comparar com `corretor-spec.json`, sem alterar código.

Resultado: 256 itens da especificação conformes, 11 divergentes, 2 parciais, nenhum ausente, 78 extras e
37 fora do código (contas, deploy e processo). As divergências estão listadas em
`docs/handoffs/2026-09-11-infra-neon-r2.md`.

Testes executados: nenhum nesta etapa; análise somente de leitura.

## Registros anteriores

O trabalho anterior a 11/09/2026 está nos commits do Git e no `PLANO-PROJETO-CORRETOR.md`.
Não havia registro por agente antes desta data.

## 2026-09-13 — Ambiente de teste
- Criado bucket privado Cloudflare R2 \corretor-documentos-test\ para documentos de locação/proprietários/inquilinos.
- Vercel e Neon não foram alterados: CLI local retornou sessão desconectada; reconectar antes de criar preview/branch.


## 2026-09-13 — Codex: URLs em português concluídas
Rotas públicas: /imoveis/{tipo}, /imoveis/para-alugar, /imoveis/para-comprar e combinações; query cidade/preco-minimo/preco-maximo/pagina. Painel: /admin/entrar e /admin/contatos. URLs antigas redirecionam 301; navegador usa replace; slugs e APIs preservados.
Publicação Vercel dpl_Bbf5617bGJdqKv79WJbuDDFJaP1M READY, alias https://corretor-web-test.vercel.app. SITE_URL e SEO_INDEXABLE configuradas em Production conforme autorização. Robots, llms e sitemap respondem 200; raiz index,follow; filtros noindex,follow; painel noindex,nofollow. Sitemap contém início e privacidade (catálogo público sem imóveis no momento).
Validação: typecheck, lint, build, suíte de 93 testes e teste adicional de navegação aprovado (94 no total coberto); smoke SSR/proxy/discovery aprovado. Navegador: redirecionamento, paginação e detalhe com fixture local; catálogo filtrado publicado confirmado. Login autenticado/logout e fichas reais não exercitados no navegador nesta sessão; permissões existentes cobertas pela suíte. Sem commit/push.
Arquivos do front: services/urls.ts e testes, App.tsx, Catalog, PublicLayout, PropertyCard, PropertyDetail, AdminLayout, Dashboard, Login, PropertyForm, SEO server/metadata e testes, scripts/seo-smoke.mjs. API: apenas documentação; alterações preexistentes em .env.example e .gitignore preservadas. Nenhuma dependência, migration ou alteração de dados.


## 2026-09-13 — Preparação de commit e push autorizada
Codex: revisão do diff concluída; typecheck, lint, 21 arquivos/94 testes, build e smoke de SEO aprovados novamente. Front: código e documentação das URLs; API: somente documentação correspondente. Alterações anteriores da API em .env.example e .gitignore excluídas do commit.
## 2026-09-13 — Investigação do HTTP 500 no upload de mídia

Logs do serviço Render `srv-daj21e15efls73fab4gg` no horário do erro mostram `Error: write EPROTO ... SSL alert handshake failure` e `GlobalExceptionFilter`. O proxy do front encaminha o multipart por streaming e o controller chega ao `MediaService`; a falha ocorre no `PutObject` do S3 antes do banco. Causa provável: `R2_ENDPOINT` inválido ou incompatível com TLS no ambiente Render. Nenhum segredo foi lido ou registrado; correção pendente no painel Render, seguida de novo teste autenticado.

## 2026-09-13 — Codex: investigação NoSuchBucket
Verificação somente de leitura no Cloudflare e Render; bucket corretor-midia não consta na conta conectada, enquanto corretor-documentos-test existe. Confirmados MediaService (bucket fixo) e configuração do S3Client por R2_ENDPOINT. Causa exata depende de comparar endpoint implantado com a conta consultada; não criar bucket ou mudar credenciais sem essa confirmação. Alterados PROJECT_STATUS.md e CHANGELOG_AI.md, preservando registros anteriores. Nenhuma mudança de código/infraestrutura; testes de código não executados, upload autenticado não refeito.


## 2026-09-13 — Codex: provisionamento de mídia autorizado
Criado corretor-midia, ativado r2.dev e atualizado somente R2_PUBLIC_URL do Render para https://pub-64e891dc485143119f5d8fddfa8280be.r2.dev. Deploy automático dep-dajfg6gjo6nc73dlrs10 confirmado LIVE; health HTTP 200. Teste real pelo conector Cloudflare: gravação temporária, leitura pública HTTP 200 e exclusão bem-sucedidas. Verificação encontrou documentos-test com acesso r2.dev ativo: desativado, sem domínios personalizados. Credenciais e endpoint preservados conforme confirmação do dono. Arquivos: PROJECT_STATUS.md, DECISIONS.md, CHANGELOG_AI.md. Sem mudança de código, sem testes unitários ou commit. Upload pelo painel com credenciais S3 do Render ainda não exercitado.

## 2026-09-13 — opencode: capa na listagem pública

Tarefa: a capa definida no painel não aparecia no catálogo ("Foto em breve"), só no detalhe do imóvel.

Alterações em código (API apenas, sem migration, rota ou DTO novo):

- `src/properties/properties.service.ts`: `list()` anexa mídias com segunda query (`In` + `orderIndex`) antes de `toPropertyResponse`; paginação por `findAndCount` preservada.
- `src/properties/properties.module.ts`: `PropertyMedia` registrado no `forFeature` do módulo.
- `src/testing/media-repository.fixture.ts`: filtro passa a entender o operador `In`.
- `src/properties/properties.http.spec.ts`: teste novo "includes ordered cover media in public listings".

Testes executados (resultado real):

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm test`: 18 suítes, 191 testes aprovados.

Risco/pendência:

- Conferência com dados reais e redeploy no Render pendentes; sem commit/push (aguardando confirmação do dono).

## 2026-09-14 — Codex: refatoração integral do backend em português

Pedido: implementar o documento integral de 13/09/2026; dono confirmou Drive compartilhado. Arquivos: novos domínios src/autenticacao, corretores, cadastros, imoveis, midias, clientes, locacoes, comissoes, drive, comum, saude; migration 1789516800000 e migração de legado, registro de entidades/migrations, logger seguro, CLI de migrations e bootstrap ADMIN com CPF; atualização app.module/main/config/.env.example/package scripts. Diretórios antigos de negócio substituídos, sem editar migrations históricas. Novos testes de domínio, HTTP e PostgreSQL; documentação/contexto/spec de ambos repos atualizados preservando histórico.

Resultado: auditoria/soft delete, filtros e classificação dinâmica, autorização por domínio, refresh atômico, último ADMIN protegido, partes pesquisáveis sem cifra, contratos com Drive idempotente, comissões com centavos exatos e jobs. Migração mantém o arquivo legado e exige dados reais complementares; CLI não imprime SQL/parâmetros privados. Revisão independente corrigiu vazamento nos logs da CLI antiga e ausência de cliente manual para comissão histórica sem lead; mídia passou a distinguir MP4 de HEIC/AVIF.

Verificações finais reais em 14/09/2026: typecheck PASS; lint PASS; build PASS; Jest local 26 suítes/169 testes PASS, 4 testes integrados opcionais excluídos do comando local; Jest integrado executado separadamente, 1 suíte/4 testes PASS no Neon PostgreSQL 16.15. Total: 173 testes aprovados. Integração cobre migração com dados sintéticos cifrados, IDs/hashes/tags, constraints/FKs/capa/contrato, saúde, login/cookie seguro, catálogo sem dados privados, cadastro manual sem consentimento inventado, parcelas e baixa via HTTP com repos reais. Transação revertida e database homologacao_pt isolada do banco publicado.

Infra de homologação: branch homologacao-backend-portugues-20260913, br-ancient-sound-a5tsf5rf, projeto corretor-db-test; database nova homologacao_pt, conexão direta TLS. Sem aplicação no banco principal, sem R2/Drive reais nesta rodada, sem commit/push/deploy. Não alterado .env. Pendências: frontend/SSR compatível, Drive real, R2 real, complementos/backup e corte coordenado incluindo health /api/v1/saude. Interrupção abrupta entre R2 e commit pode exigir conciliação; simulações cobrem compensação de falhas retornadas.
## 14/09/2026 — integração do frontend ao contrato português

Frontend irmão integrado às rotas da API, com testes de contrato e filtros de data de clientes adicionados. API segue com typecheck, lint e suíte local/integrada validados. Drive, migração de dados reais e publicação permanecem pendentes de configuração operacional.

## 2026-09-16 — Correção operacional do deploy Render

Após o deploy do commit `896c39c`, o serviço falhou no boot porque `ALLOWED_ORIGINS`
continha uma origem HTTP em produção. A variável foi corrigida no Render para
`https://corretor-web-test.vercel.app`, sem alterar código, segredos ou banco. O deploy
`dep-dal39v2d0e5s738d6vng` ficou `live`; saúde HTTP 200 e preflight CORS 204 confirmados.

## 2026-09-16 — Correção dos achados confirmados de segurança

Alterados os guards de `src/cadastros/cadastros.controller.ts`, o ciclo de senha/sessões em
`src/autenticacao/` e a validação de `ALLOWED_ORIGINS` em `src/config/env.validation.ts`.
Corretores comuns não podem mais criar, editar ou desativar cadastros globais; troca de senha
revoga todos os refresh tokens do usuário; produção rejeita CORS HTTP. Nenhum dado, migration,
infraestrutura ou segredo foi alterado. Rate limit distribuído e `trust proxy` permanecem
pendentes de decisão de infraestrutura; restrições de dados de locação já estão aplicadas no
serviço atual.


## 2026-09-16 — Pacote de melhorias do frontend irmão

Codex concluiu melhorias públicas e administrativas em Corretor-web, reutilizando os contratos atuais de
imóveis/clientes/contratos/comissões. Nenhum código, DTO, dependência, migration ou dado desta API foi alterado.
Dashboard percorre todas as páginas de comissões; contatos usam imovel_id/criado_desde/criado_ate. Origem é somente
informativa porque ConsultaClientesDto não aceita esse filtro; ordenação adiada. Duplicação usa POST existente e slug novo.
Validação frontend e limites de homologação registrados no CHANGELOG_AI.md do Corretor-web; testes desta API não foram
reexecutados neste corte exclusivamente documental. Sem commit/push/deploy.
