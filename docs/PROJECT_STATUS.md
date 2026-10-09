# Estado atual — corretor-api

## Estado atual (09/10/2026)

`main` em `6b987a5`, sincronizada com `origin/main`. Trabalho direto na `main`.

### Serviços

Último registro datado de cada um. Não presuma estado mais novo sem conferir.

| Serviço | Estado | Registro |
|---|---|---|
| Neon | ativo, contrato v2 | recriado em 17/09 com as 10 migrations; carga do catálogo em 03/10 (12 imóveis, 36 mídias, segundo ADMIN) |
| Cloudflare R2 | ativo, bucket `corretor-midia` | em 03/10 a URL pública configurada respondeu 401; catálogo usa URLs do Unsplash e a foto do perfil sai pela API |
| Render (API de teste) | serviço `Corretor-API` | deploy manual do `86ecf29` em 08/10, `/api/v1/saude` ok (registro no Corretor-web) |
| Vercel (front de teste) | `corretor-web-test.vercel.app` | publicado desde 13/09; em 08/10 o proxy `/api` serviu a foto do perfil |
| Google Drive | não homologado | sem credenciais reais testadas |

### Pronto no código

- Modelo em português com ids inteiros e cadastro único de pessoas (62 rotas).
- Sessão de 4h por inatividade, sem rotação do token; revogação na troca de senha, no reset pelo ADMIN e na desativação.
- Foto do perfil por upload multipart e leitura pública em `GET /corretores/:id/foto`.
- CRECI validado, `tipo_id` em lista e `GET /admin/comissoes/pessoas-elegiveis` (09/10).
- Comissão editável com plano versionado, histórico imutável e trava otimista; índices de reajuste e tipos de
  contrato com snapshot no contrato; ids limitados a int4 (09/10, local, sem commit). Migration
  `1789689600000-comissao-versionada-cadastros-contrato` validada só em PostgreSQL descartável: 17/17 na migration,
  62/62 no QA HTTP e 37/37 no navegador. Ver [2026-10-09-comissao-versionada-cadastros-contrato.md](2026-10-09-comissao-versionada-cadastros-contrato.md).
- Correções da auditoria full stack de 02 e 03/10 (A01, A02, A03, A09, A10).
- Typecheck, lint e build aprovados em 09/10. QA efêmero de 09/10: 78/78 na API e 63/63 no navegador, com
  PostgreSQL descartável em Docker.

### Falta homologar

- Sessão de 4h no navegador real: F5 seguido, fechar o navegador, inatividade.
- Foto do perfil completa: login, upload, banco real, proxy e sessão juntos; Safari, iOS e celular físico.
- A09/A10 em PostgreSQL real e A11 no ambiente publicado (AUDIT-001).
- Google Drive com credenciais reais.

### Bloqueios e dependências

- O `6b987a5` não foi publicado. O front de 09/10 depende dele: a API precisa sair antes (DEPLOY-001).
- A migration de comissão versionada e cadastros de contrato não foi aplicada no Neon. Exige backup verificado e
  autorização; o front correspondente não salva contratos contra a API antiga (MIGRATION-20261009).
- `npm test` sai com código 1 porque não há suítes (TEST-API).
- Regras de encerramento e renovação de contratos e a validação contábil das comissões aguardam o dono (RENTAL-004).
- Aviso de novo contato aguarda a escolha do canal (NOTIFY-001).

Tarefas em [TASKS.md](TASKS.md). Detalhes de cada entrega em [CHANGELOG_AI.md](CHANGELOG_AI.md).

## Histórico resumido

| Data | Marco |
|---|---|
| 09–10/09 | MVP em inglês com UUID (`agents`, `properties`, `leads`). |
| 11/09 | Neon e R2 criados, 5 migrations iniciais aplicadas, primeiro ADMIN, teste ponta a ponta de 25 passos. Camada de contexto dos agentes. |
| 12/09 | Limpeza dos dados de homologação. Administração de locações no modelo intermediário. |
| 13/09 | Comissão de captação, URLs em português publicadas na Vercel, bucket `corretor-midia` recriado, perfil próprio e troca de senha. |
| 14/09 | Backend refeito em português (`f5bd264`): auditoria universal, exclusão lógica, Drive e comissões manuais. |
| 16/09 | Hardening de segurança (`896c39c`) publicado no Render. Contrato v2 com ids inteiros e `pessoas` (`0140947`). |
| 17/09 | Neon zerado e recriado com as 10 migrations; administrador recriado e login restabelecido. |
| 20/09 | Slug do imóvel gravado depois do insert; imóveis duplicados apagados (`f585fed`). |
| 02/10 | Gaps da auditoria full stack corrigidos e testes legados removidos (`7f59109`). |
| 03/10 | Revisão da auditoria; remoção de todas as suítes de teste (`ab59472`); carga do catálogo ilustrativo no Neon. |
| 04/10 | Listagem interna ativa por padrão, mensagens 409 de contrato e documentação plana em `docs/` (`77cdaa7`, `b9d1d55`). |
| 06/10 | Sessão de 4h por inatividade (`46f2235`) e foto do perfil (`86ecf29`). |
| 08/10 | Render recebe o `86ecf29`; foto do perfil passa a responder no ambiente de teste. |
| 09/10 | CRECI, `tipo_id` em lista e pessoas elegíveis (`6b987a5`). Documentação revista para o estado atual. |
| 09/10 | Comissão versionada, índices de reajuste e tipos de contrato, migration nova; entrega local, sem commit. |
