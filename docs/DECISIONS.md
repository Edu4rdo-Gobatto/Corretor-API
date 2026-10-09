# Decisões técnicas — corretor-api

Cada decisão traz a data, o que vale e o que **não** fazer. Antes de contrariar uma decisão, revise-a aqui e
registre a mudança com a nova data. Uma decisão nova que substitui outra move a antiga para "Substituídas".

O texto completo das versões anteriores está no histórico do Git.

## Decisões em vigor

### 09/10 — Comissão com plano versionado e trava otimista
- Toda alteração de comissão (`PATCH`) envia `versao_registro`; versão divergente responde 409. Baixa efetiva também
  incrementa a versão. Só mudanças efetivas contam.
- Mudança financeira ou de vínculo cria outro plano (`versao_plano`); o anterior fica guardado e inativo, nunca é
  apagado. Revisões em `comissao_revisoes` são imutáveis (trigger). Depois de qualquer recebimento, só observações,
  arquivamento e reativação.
- Arquivar é `PATCH {ativo:false}`; `DELETE /admin/comissoes/:id` foi removido.
- Não: recalcular parcelas ou pagamentos existentes; editar ou apagar revisões; aceitar PATCH sem versão.
- Registro da migration `1789689600000-comissao-versionada-cadastros-contrato` (não aplicada no Neon em 09/10).

### 09/10 — Índices de reajuste e tipos de contrato com snapshot
- Cadastros próprios do ADMIN, fora das classificações do catálogo público e do SSR; nomes únicos sem acento/caixa,
  inclusive inativos; desativação lógica.
- O contrato guarda o nome do tipo e o nome, a periodicidade e a regra do índice no momento da escolha; só refaz o
  snapshot quando o id muda. O texto `indice_reajuste` vira cópia do nome do índice.
- Contrato legado mantém o texto até ser classificado; por decisão do dono, qualquer edição de contrato legado exige
  classificar (o arquivamento não).
- Não: calcular ou alterar aluguel a partir do índice; atualizar contratos ao renomear o cadastro.

### 09/10 — Ids limitados a int4 nos DTOs
`IdRegistro` passou a ter `Max(2147483647)`, como já tinha `ListaIds`. Ids maiores respondem 400 em vez de erro do banco.


### 11/09 — Princípios do projeto e alternativas descartadas
- Custo $0 durante a validação: nada pago entra até haver cliente pagante.
- Banco sempre online, no Neon. Nunca Postgres local.
- Simplicidade acima de sofisticação: um padrão por problema, uma ferramenta por função (um ORM, um validador).
- Limites de plano gratuito (disco efêmero, cold start) são documentados e decididos, nunca ignorados.
- Descartadas, sem reabrir sem motivo novo:
  - **Supabase:** o plano gratuito pausa o projeto, e a volta demora demais.
  - **Cloudflare Workers + Hono:** o limite de CPU do plano gratuito não comporta Argon2id.
  - **Drizzle:** só fazia sentido com Workers; o padrão do NestJS é o TypeORM.
  - **GitHub Actions para backup:** workflows agendados param após 60 dias sem atividade.
  - **Cloudflare Containers:** exige plano pago.

### 11/09 — Neon em São Paulo, conexão direta
PostgreSQL 16, banco `corretor-db`, região `aws-sa-east-1`, URL sem `-pooler`. Migrations e advisory locks precisam
de sessão. Não trocar para o pooler sem testar; não recriar o projeto; não usar Postgres local. O Render não tem
região na América do Sul, então API e banco ficam em continentes diferentes.

### 11/09 — Primeiro ADMIN por comando
`npm run bootstrap:admin` cria o primeiro ADMIN e recusa se já houver um. Não criar rota pública de cadastro
inicial. Remover as `BOOTSTRAP_ADMIN_*` do `.env` depois do uso. O comando não redefine senha.

### 11/09 e 16/09 — Origens autorizadas explícitas
`ALLOWED_ORIGINS` lista origens exatas, sem barra final. Em produção, só HTTPS (16/09). Como o cookie é sempre
`Secure`, o desenvolvimento no navegador também usa HTTPS (`https://localhost:5173` no `.env.example`). Não usar `*`
nem casar por prefixo. Incluir o domínio do front antes de publicar, senão o login responde 403.

### 11/09 — Uma única branch: `main`
Trabalho direto na `main`, sem branches paralelas. Commit só com confirmação do dono e depois de typecheck, lint e
build. Não commitar `.env`, dump ou credencial.

### 11/09 — Mídia no Cloudflare R2
Bucket `corretor-midia`, nome fixo em `src/midias/midias.service.ts` e `src/corretores/fotos-corretor.service.ts`.
Upload em memória direto ao R2, nunca em disco. Não expor `chave_armazenamento` em resposta. Não usar a URL `r2.dev`
como endereço definitivo de produção. Em 03/10 a URL pública configurada respondeu 401; não mudar a política do
bucket sem decisão nova.

### 11/09 — Backup antes de mudança estrutural
Backup do banco antes de migration ou exclusão de dados, com `pg_dump` pela imagem Docker `postgres:16`. A máquina
tem Docker, mas não tem `pg_dump` instalado. Backups ficam em `backups/`, fora do Git.

### 13/09 — Listagem de imóveis em duas fases
A listagem busca os ids da página e depois carrega mídias e características desses ids em consultas separadas.
Não colocar a relação um-para-muitos dentro da consulta paginada: o `LIMIT` passaria a contar linhas do JOIN.

### 13/09 — Perfil próprio por lista fechada
`PATCH /autenticacao/eu` aceita só `nome`, `whatsapp`, `creci`, `url_foto` e, desde 06/10, o arquivo `foto`. O id vem
do JWT. E-mail, `cargo` e `ativo` só mudam por `PATCH /admin/corretores/:id`, exclusivo do ADMIN.

### 13/09 — Filtro `status` só no catálogo interno
`status` existe em `ConsultaInternaImoveisDto`. O catálogo público não aceita o parâmetro (400) e só lista
`DISPONIVEL`.

### 14/09 — Modelo integral em português
- Domínio, rotas, DTOs e colunas em português e `snake_case`, com auditoria em todas as tabelas.
- Exclusão lógica com `ativo`. Exceções físicas: mídia e sessão.
- Dados pessoais em colunas reais, sem criptografia de coluna. A proteção vem de TLS, disco cifrado e autorização.
- Documentos de contrato no Google Drive compartilhado, por Service Account; as quatro `GOOGLE_DRIVE_*` juntas.
  Falha do Drive preserva o contrato com `status_pasta_drive = FALHOU`.
- Comissão é receita da imobiliária, de venda ou de locação, com valor informado e até 600 parcelas. Não presumir
  valor de aluguel, repasse mensal, integração bancária ou comissão de corretor.
- Cookie `Secure`, `SameSite=Strict` e `HttpOnly` em todos os ambientes.

### 14/09 — Executor próprio de migrations
`npm run migration:*` usa `src/commands/migracoes.ts`, que não imprime SQL nem parâmetros e exige
`MIGRACAO_BACKUP_ARQUIVO` para executar ou reverter. Não usar a CLI do TypeORM diretamente. Manter
`src/database/migracao-legado.ts`, dependência da migration `1789516800000` (reforçado em 02/10).

### 16/09 — Cadastros globais só para ADMIN
Criar, alterar e desativar tipos, finalidades e características exige `CargosGuard` com `ADMIN`. A leitura dos
ativos é pública. Não adicionar Redis nem alterar `trust proxy` sem decisão de infraestrutura.

### 16/09 — Ids inteiros, pessoas unificadas e ficha do imóvel
Todo `id` é inteiro `GENERATED BY DEFAULT AS IDENTITY`. `clientes` e `partes_locacao` viraram `pessoas`, sem coluna de
papel. Imóvel com `valor_venda` e `valor_locacao`, status `DISPONIVEL | RESERVADO | VENDIDO | ALUGADO | RETIRADO` e
ficha interna só nas rotas `/admin`. Slug `<titulo>-<id>`. Não reintroduzir UUID nem cadastros separados por papel.

### 17/09 — Banco recriado do zero
O Neon foi zerado e recriado pelas 10 migrations porque não havia dado de negócio. Não repetir com dados reais:
nesse caso vale backup restaurável e corte coordenado. Conferir `typeorm_migrations` no banco antes de decidir.

### 20/09 — Slug gravado depois do insert
O insert do imóvel vai sem id, com slug provisório `rascunho-<uuid>`; o slug definitivo é gravado na mesma transação.
`atualizar` recalcula o slug sempre. Não reservar id com `nextval`: o TypeORM descarta id explícito em coluna gerada.
`DELETE /admin/imoveis/:id` só desativa.

### 02/10 — Revogação de sessões no reset pelo ADMIN e na desativação
Além da troca da própria senha (16/09), a redefinição de senha pelo ADMIN e a desativação do corretor apagam todas
as sessões dele, na mesma transação.

### 02/10 — Limpeza de sessões por `setInterval`
`SessoesService` apaga sessões expiradas no boot e a cada hora, com `setInterval` e `unref()`. Não há cron para isso.

### 03/10 — Revisão da auditoria full stack
- A01: partes já autorizadas no contrato podem permanecer; pessoa nova exige carteira própria ou vínculo prévio.
- A02: autorização antes do multipart; lote limitado a 60 MiB durante a recepção; no máximo 2 uploads simultâneos
  por instância; envio ao R2 fora da transação, com revalidação e lock na gravação. Não manter transação aberta
  durante o R2.
- A09: classificação inativa ainda vinculada mantém o valor; removida não volta.
- A10: busca telefônica por dígitos, aceitando +55, sem alterar telefones gravados.

### 03/10 — Sem suítes de teste
Todos os arquivos `*.spec.*` e `*.test.*` foram removidos a pedido do dono. Não recriar suítes sem novo pedido. Não
alegar validação por testes. A validação usa typecheck, lint, build e QA efêmero fora do repositório. O que fazer com
o Jest restante está em TEST-API.

### 04/10 — Listagem interna e conflitos de contrato
`GET /admin/imoveis` traz só ativos por padrão; inativos só com `ativo=false`. Filtros `sem_contrato_ativo` e
`apenas_disponiveis`. Erro `23505` de contrato vira 409 com mensagem pela constraint (número repetido ou imóvel com
contrato ativo).

### 04/10 — Documentação plana em `docs/`
Todo `.md` fica em `docs/`, sem subpastas e sem arquivos soltos na raiz.

### 06/10 — Sessão expira após 4h de inatividade
- JWT de acesso de 15 minutos.
- Cookie `corretor_renovacao` HttpOnly, `SameSite=Strict`, `Secure`, sem `maxAge`: fechar o navegador encerra a sessão.
- `sessoes_login.expira_em = agora + 4h`. Sem limite absoluto.
- Token fixo, sem rotação: `renovar` faz `UPDATE ... RETURNING` e só emite um JWT novo.
- `AtividadeSessaoInterceptor` global estende o prazo a cada requisição autenticada, no máximo uma escrita a cada 5 min.
- Motivo: o cookie de 30 dias nunca expirava, e a rotação de uso único derrubava o login no F5.
- Não fazer: voltar a rotacionar sem tolerância a respostas abortadas; dar `maxAge` ao cookie; gravar atividade em
  toda requisição; mover a gravação para o `AutenticacaoGuard` (ciclo de módulos).

### 06/10 — Foto do perfil sem migration
Chave `corretores/{id}/{uuid}.jpg|png|webp` no mesmo bucket. `ArmazenamentoModule` compartilha o cliente R2 e a cota
de upload. Envio antes da transação; objeto novo compensado se o banco falhar; foto anterior apagada só depois do
commit. URL gerenciada diferente da atual, sem arquivo novo, responde 409. Leitura pública só pelo id do corretor
ativo, com proxy do R2 ou redirect para URL externa HTTPS.

### 09/10 — CRECI, `tipo_id` em lista e pessoas elegíveis
- CRECI: trim, maiúsculas, vazio vira `null`, regra `^\d+[JF]?$`. Valores antigos fora da regra continuam legíveis.
- `tipo_id` em `GET /imoveis` e `/admin/imoveis`: um id ou CSV de até 20 (`ListaIds`). O cadastro segue com um tipo.
- `GET /admin/comissoes/pessoas-elegiveis` fica antes de `:id` e devolve só `{ id, nome }`. O `POST` mantém as checagens.

## Substituídas

| Data | Decisão antiga | Substituída por |
|---|---|---|
| 11/09 | Sessão de 30 dias com refresh rotativo de uso único | Sessão de 4h por inatividade, token fixo (06/10) |
| 11/09 | "As 5 migrations foram aplicadas"; `migration:revert` derruba a tabela | Banco recriado com 10 migrations (17/09); as duas últimas recusam reversão |
| 11/09 | Contexto dos agentes com pasta `docs/handoffs/` | Documentação plana em `docs/` (04/10) |
| 11/09 | Não commitar sem `npm test` | Sem suítes; typecheck, lint e build (03/10) |
| 12/09 | Limpeza manual de `refresh_sessions` e proibição de `setInterval` | Limpeza automática por `setInterval` em `sessoes_login` (02/10) |
| 12/09 | Locações com dados cifrados em AES-256-GCM e documentos em bucket R2 privado, acesso só ADMIN | Modelo de 14/09: sem cifra, documentos no Drive, acesso do intermediador |
| 12/09 | Comissão de captação igual a um aluguel | Comissão manual de venda ou locação (14/09) |
| 12/09 | `.env.example` sobrescrito sem comentários | `.env.example` versionado com comentários (estado atual do arquivo) |
| 13/09 | Troca e reset de senha sem revogar sessões | Troca revoga (16/09); reset pelo ADMIN e desativação revogam (02/10) |
| 13/09 | Nomes `PropertiesService`, `/auth/me`, `/agents/:id`, `storageKey` | Nomes em português do modelo de 14/09 |
| 14/09 | Sessão "consumida" na renovação | Renovação sem consumo (06/10) |
| 02/10 | Preservar `modelo-portugues.integracao.spec.ts` e usar `env.validation.spec.ts` | Remoção de todas as suítes (03/10) |
