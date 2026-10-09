# Histórico de trabalho dos agentes — corretor-api

> **Regra:** daqui em diante este arquivo só recebe acréscimos. Cada nova entrada vai no fim, com data, agente,
> tarefa, arquivos, validação com o resultado real e pendências. Não reescreva entradas anteriores.
>
> Até 09/10/2026 o histórico foi resumido por período. O texto completo das entradas antigas está no Git.

## 11–13/09/2026 — Infraestrutura, MVP e primeiras extensões

Entregue:
- Análise do repositório contra `corretor-spec.json`.
- Neon (`corretor-db`, PostgreSQL 16, São Paulo, conexão direta) e R2 (`corretor-midia`) criados.
- 5 migrations iniciais aplicadas e primeiro ADMIN criado por `bootstrap:admin`.
- Camada de contexto dos agentes (AGENTS, CLAUDE, PROJECT_STATUS, DECISIONS, TASKS, CHANGELOG).
- Limpeza dos dados de homologação.
- Módulo de locações com documentos cifrados em bucket privado e comissão de captação parcelada (modelo
  intermediário, substituído em 14/09).
- Capa das mídias na listagem pública; perfil próprio e troca de senha; filtro de status no catálogo interno.
- No ambiente de teste: bucket `corretor-midia` recriado após o erro `NoSuchBucket`, e URLs em português do front
  publicadas na Vercel.

Validação: teste ponta a ponta com Neon e R2 reais em 25 passos, aprovado; suítes Jest de 130 a 195 testes
aprovadas conforme a entrega.

Achados: o commit `accd5d9` citado numa sessão anterior nunca existiu no repositório; o login do ADMIN quebrou
em 12/09 (resolvido em 17/09).

## 14–17/09/2026 — Modelo em português, contrato v2 e banco recriado

Entregue:
- 14/09: backend refeito em português (`f5bd264`). Auditoria universal, exclusão lógica, dados pessoais sem cifra,
  Drive compartilhado por Service Account, comissões manuais com até 600 parcelas e migration `1789516800000`.
- 16/09: hardening (`896c39c`). Rotas de cadastros só para ADMIN, troca de senha revoga as sessões e CORS só HTTPS
  em produção. O deploy no Render ficou `live` depois da correção de `ALLOWED_ORIGINS`.
- 16/09: contrato v2 (`0140947`). Ids inteiros, tabela única `pessoas`, ficha interna do imóvel, novos filtros e
  migration `1789603200000`.
- 17/09: Neon zerado com autorização do dono e recriado com as 10 migrations. Administrador recriado com id 1.

Validação: typecheck, lint e build aprovados; 175 testes aprovados em 17/09; integração das migrations em
PostgreSQL 16 aprovada em 16/09. Execução real contra o Neon em 17/09: saúde, catálogo e login responderam 200.

Pendências da época: CPF de exemplo do administrador e `BOOTSTRAP_ADMIN_*` no `.env` (ADMIN-001).

## 20/09/2026 — Slug do imóvel

Entregue (`f585fed`): o insert do imóvel vai sem id e o slug definitivo é gravado logo depois, na mesma
transação. O TypeORM descartava o id reservado com `nextval`, o que gerava 404 na ficha pública. Imóveis duplicados
4, 6, 8, 10 e os de verificação 11 e 12 foram apagados após backup em JSON.

Validação: typecheck, lint, build e 176 testes aprovados; verificação HTTP contra o Neon aprovada.

## 02–04/10/2026 — Auditoria full stack, remoção dos testes e documentação plana

Entregue:
- 02/10: gaps da auditoria (`7f59109`). Autorização de partes no contrato (A01), `PodeEditarImovelGuard` e envio ao
  R2 fora da transação (A02), revogação de sessões no reset pelo ADMIN e na desativação (A03), características
  inativas na ficha (A09), busca telefônica por dígitos (A10), `retryAttempts: 3`, reset do limite de login após
  sucesso e limpeza de sessões no boot. Testes legados e planos antigos removidos.
- 03/10: revisão da auditoria. Limite do lote durante a recepção, cota de 2 uploads simultâneos, +55 na busca.
- 03/10: carga do catálogo ilustrativo no Neon (12 imóveis, 36 mídias, segundo ADMIN), com backup prévio.
- 03/10: todas as suítes de teste removidas a pedido do dono (`ab59472`).
- 04/10: listagem interna ativa por padrão, filtros `sem_contrato_ativo` e `apenas_disponiveis`, mensagens 409
  específicas de contrato (`77cdaa7`). Documentação centralizada em `docs/`, plana (`b9d1d55`).

Validação: 188 testes aprovados em 03/10, antes da remoção. Depois: typecheck, lint e build aprovados.

## 06/10/2026 — Sessão de 4h e foto do perfil

Entregue:
- Sessão expira após 4h sem requisições (`46f2235`). Cookie sem `maxAge`, token fixo renovado por
  `UPDATE ... RETURNING` e `AtividadeSessaoInterceptor` global. Corrigiu o login que nunca expirava e a queda no F5.
- Foto do perfil (`86ecf29`): `PATCH /autenticacao/eu` multipart, `GET /corretores/:id/foto` e
  `ArmazenamentoModule` compartilhado. A carga do catálogo entrou no mesmo commit.
- Em 08/10 o Render recebeu o `86ecf29` (registro no Corretor-web).

Validação: typecheck, lint e build aprovados. QA efêmero com 22 cenários HTTP e 23 cenários no navegador; R2 real
com objeto temporário enviado, lido e apagado. Pendente: teste da sessão no navegador real e homologação completa da
foto.

## 09/10/2026 — Seis pontos (commit `6b987a5`)

Entregue:
- `GET /admin/comissoes/pessoas-elegiveis`, declarada antes de `:id`, com as mesmas regras de pessoa do `POST`.
- `tipo_id` em CSV de até 20 ids (`ListaIds`) no catálogo público e no interno.
- CRECI normalizado e validado com `^\d+[JF]?$`.
- Documentação revista para o estado atual; `PLANO-PROJETO-CORRETOR.md` apagado e histórico resumido.

Validação: typecheck, lint e build aprovados. `npm test` termina com "No tests found" e código 1. QA efêmero
78/78 com módulos reais e PostgreSQL 16 descartável em Docker; navegador integrado ao front 63/63. Sem acesso ao
Neon ou ao R2.

Pendências: publicar a API antes do front (DEPLOY-001).

## 09/10/2026 — Comissão versionada, cadastros de contrato e entrega local (Claude)

Entregue (local, sem commit, push, deploy ou Neon):
- Migration `1789689600000-comissao-versionada-cadastros-contrato`: versões de plano e de registro, unicidade das
  parcelas por plano, `comissao_revisoes` imutável com backfill v1, `indices_reajuste`, `tipos_contrato` e snapshot no
  `contrato`.
- Comissão: `PATCH` completo com `versao_registro`, mudanças efetivas, bloqueio após recebimento, novo plano por
  mudança financeira, reativação com revalidação, baixa de plano substituído 409, `GET /:id/revisoes`, `DELETE` removido.
- Módulo `cadastros-contrato`: CRUD ADMIN e opções ativas autenticadas.
- Contratos: tipo e índice obrigatórios no `POST`; legado classificado na edição; snapshot só quando o id muda.
- `IdRegistro` limitado a int4.

Arquivos: `src/database/migrations/1789689600000-*`, `src/database/registros.ts`, `src/app.module.ts`,
`src/comissoes/*` (entidades, `revisao-comissao.entity.ts`, DTO, service, controller, module),
`src/cadastros-contrato/*`, `src/locacoes/{contrato.entity,locacoes.dto,locacoes.service}.ts`, `src/comum/dto.ts`,
`corretor-spec.json` e documentação.

Validação: typecheck, lint e build aprovados; `npm test` não executado (sem suítes). Migration em PostgreSQL 16
descartável com legados: 17/17. QA HTTP com módulos reais: 62/62 (inclui 6/6 corridas de edição × baixa). Navegador
com a API completa: 37/37. Roteiros fora do repositório.

Pendências: MIGRATION-20261009 (backup verificado, migration no Neon, API antes do front, cadastrar tipos e índices).

