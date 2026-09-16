# Decisões técnicas — corretor-api

Cada decisão registra a data, o motivo e o que **não** fazer. Antes de contrariar uma decisão, revise-a aqui
e registre a mudança com a nova data.

## 2026-09-11 — Banco no Neon, região São Paulo, conexão direta

Decisão: o projeto Neon foi criado com PostgreSQL **16**, banco `corretor-db`, na região `aws-sa-east-1` (São Paulo),
e a aplicação usa a **connection string direta**, sem o sufixo `-pooler`.

Motivo: a versão 16 acompanha a especificação. A conexão direta é a recomendada pelo Neon para migrations e `pg_dump`,
e o pooler em modo transação não suporta parte dos recursos de sessão. A região foi escolhida pelo dono do projeto.

Não fazer:

- Não trocar para a URL com `-pooler` sem testar migrations e o advisory lock da edição de corretores.
- Não recriar o projeto Neon: a região é fixa e a recriação perde o banco atual.
- Não usar Postgres local: a validação de ambiente exige host `*.neon.tech`.
- Lembrar no planejamento de deploy: o Render não tem região na América do Sul, então API e banco ficarão em continentes diferentes.

## 2026-09-11 — Migrations aplicadas no banco real

Decisão: as 5 migrations do repositório foram aplicadas no Neon e o schema real passou a existir.

Motivo: encerrar a fase de "código pronto, banco inexistente" e permitir homologação com dados reais.

Não fazer:

- Não editar, renomear ou apagar migration já aplicada. Para mudar o schema, crie uma nova migration.
- Não rodar `migration:revert` em produção sem backup e autorização explícita: ela derruba a tabela correspondente.
- Não ativar `synchronize` nem `migrationsRun`.

## 2026-09-11 — Mídia no Cloudflare R2 com URL pública de desenvolvimento

Decisão: bucket `corretor-midia` (nome fixo no código), classe Standard, com a Public Development URL (`r2.dev`) ativada,
e token de API com permissão Object Read & Write restrita a esse bucket.

Motivo: é o caminho de custo zero para a fase de validação. O egress do R2 é gratuito e o filesystem do Render é efêmero.

Não fazer:

- Não renomear o bucket sem alterar o código, que tem o nome fixo em `src/media/media.service.ts`.
- Não usar a URL `r2.dev` como endereço definitivo de produção: a Cloudflare limita as requisições e a trata como recurso de desenvolvimento.
- Não gravar upload em disco: o arquivo vai da memória direto ao R2.
- Não guardar o `storageKey` em resposta pública.

## 2026-09-11 — Primeiro administrador por comando, não por rota

Decisão: o primeiro ADMIN foi criado com `npm run bootstrap:admin`, lendo variáveis `BOOTSTRAP_*` temporárias,
que foram removidas do `.env` logo depois.

Motivo: não existe rota pública de criação do primeiro administrador, e o comando recusa a operação se já houver um ADMIN.

Não fazer:

- Não criar rota pública de cadastro inicial.
- Não deixar as variáveis `BOOTSTRAP_*` no `.env` depois do uso.
- Não tentar redefinir senha pelo comando: ele não faz isso.

## 2026-09-11 — Sessão com access token curto e refresh rotativo

Decisão (herdada do código e confirmada em homologação): access token JWT HS256 de 15 minutos, mantido apenas em memória
no front, e refresh token opaco de 30 dias em cookie `httpOnly`, `SameSite=Strict`, guardado no banco apenas como SHA-256,
de uso único e rotacionado a cada renovação.

Motivo: permite revogar sessões individualmente e evita token persistido em `localStorage`.

Não fazer:

- Não guardar refresh token puro no banco nem token em `localStorage`.
- Não criar outro mecanismo de sessão sem revisar esta decisão.
- Não aumentar o access token para dias: a renovação já é automática no front.

## 2026-09-11 — Origens autorizadas explícitas

Decisão: `ALLOWED_ORIGINS` lista as origens exatas, separadas por vírgula, sem barra final. Em desenvolvimento vale
`http://127.0.0.1:5173,http://localhost:5173`.

Motivo: o CORS com credenciais e o guard de origem de login, refresh e logout comparam o header `Origin` por igualdade exata.

Não fazer:

- Não usar `*` nem casar origem por prefixo.
- Não esquecer de incluir o domínio de produção do front antes de publicar; sem isso o login responde 403.

## 2026-09-11 — Camada de contexto compartilhado entre agentes

Decisão: o repositório passa a manter `AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `DECISIONS.md`, `TASKS.md`,
`CHANGELOG_AI.md` e `docs/handoffs/`, com o mesmo protocolo no repositório irmão.

Motivo: Codex e Claude não compartilham contexto entre sessões. O que precisa sobreviver à sessão fica versionado no Git.

Não fazer:

- Não trabalhar sem ler os arquivos de contexto.
- Não encerrar uma tarefa sem atualizar `PROJECT_STATUS.md` e `CHANGELOG_AI.md`.
- Não registrar segredo, token ou dado pessoal nesses arquivos.

## 2026-09-11 — Uma única branch: `main`

Decisão: o trabalho acontece direto na `main`. A branch `shura` foi apagada do GitHub por estar em `0b21399`,
que já é ancestral da `main` e, portanto, não continha nenhum commit exclusivo.

Motivo: escolha do dono do projeto. Com um repositório pequeno e agentes trabalhando um de cada vez,
o custo de manter branches paralelas não se pagava.

Não fazer:

- Não recriar branches paralelas sem combinar antes.
- Não commitar sem rodar `npm test`, `npm run lint` e `npm run typecheck`.
- Não commitar `.env`, dump ou credencial: sem branch de revisão, o erro vai direto para a `main`.

## 2026-09-12 — Limpeza de `refresh_sessions` continua manual

Decisão: as sessões expiradas são apagadas à mão, com `DELETE FROM refresh_sessions WHERE expires_at < now()`,
até que OPS-001 defina uma rotina. Em 12/09 as 2 linhas dos logins de homologação de 11/09 foram removidas
(backup `backups/backup_20260912_0908.sql` gerado antes).

Motivo: a tabela é pequena e não há agendador confiável no plano gratuito. Automatizar antes de publicar a API
seria decidir sem conhecer a plataforma.

Não fazer:

- Não apagar sessões sem saber se há alguém logado: o `DELETE` derruba a sessão de quem estiver usando o painel.
- Não criar a rotina dentro da API com `setInterval`: o processo do plano gratuito hiberna e a limpeza não roda.

## 2026-09-12 — Variáveis `BOOTSTRAP_*` voltaram ao `.env` e devem sair

Situação registrada, não decisão nova: em 12/09 o `.env` local foi encontrado de novo com as quatro variáveis
`BOOTSTRAP_ADMIN_*` preenchidas, e o `.env.example` versionado apareceu sobrescrito com a mesma estrutura,
tendo perdido os comentários que explicavam cada campo. Isso contraria a decisão de 11/09.

Agrava o caso: a senha que está no `.env` **não é** a que está gravada no banco. O login com ela responde 401,
então o valor em texto claro não serve nem para entrar — só para vazar.

Não fazer:

- Não deixar as `BOOTSTRAP_*` no `.env` depois de criar o administrador.
- Não sobrescrever o `.env.example` com uma cópia do `.env`: o exemplo documenta os campos, e os comentários
  fazem parte dele.
- Não tratar o valor atual de `BOOTSTRAP_ADMIN_PASSWORD` como a senha do administrador: ela não é.

## Decisões herdadas da especificação (`corretor-spec.json`)

Já foram rejeitadas, e não devem ser reabertas sem revisão explícita:

- **Supabase**: o plano gratuito pausa o projeto e o tempo de retorno é inaceitável.
- **Cloudflare Workers + Hono no backend**: o limite de CPU do plano gratuito é incompatível com Argon2id.
- **Drizzle ORM**: só fazia sentido no cenário Workers; o padrão do NestJS é o TypeORM.
- **GitHub Actions para backup agendado**: workflows agendados são desativados após 60 dias sem atividade no repositório.
- **Cloudflare Containers**: exige plano pago.

## 2026-09-12 — Primeira entrega de administração de locações (Codex)

Escopo aprovado: cadastros PF/PJ de proprietários e inquilinos, dados bancários do proprietário, contratos e documentos privados. Acesso exclusivamente ADMIN, inclusive downloads. Um proprietário, um inquilino e um imóvel por contrato; início manual, sem importação e sem integração SI9/Imonov nesta etapa. Comissão aguarda definição do dono; não presumir a base nem implementar financeiro nesta entrega.

Padrões: NestJS/TypeORM e React/RHF/zod existentes, nenhuma dependência nova. Contatos, CPF/CNPJ, dados bancários e observações da ficha são cifrados com AES-256-GCM; notas do contrato também. Usa-se chave derivada com domínio próprio da LEADS_ENCRYPTION_KEY existente. Nomes permanecem pesquisáveis. Não trocar a chave sem procedimento de recifragem e backup: isso torna os campos anteriores ilegíveis.

Documentos: bucket privado separado, R2_DOCUMENTS_BUCKET opcional no boot. A variável deve apontar para bucket sem r2.dev, domínio público ou acesso anônimo, distinto de corretor-midia. O token S3 deve ter permissão nesse bucket. Sem variável, upload/download/exclusão falham com 503, sem fallback. Listagem de metadados continua disponível. Não colocar documentos de clientes no bucket público de mídia. PDF/JPEG/PNG, assinatura e limite de 10 MiB, download autenticado como attachment com no-store e nosniff. Upload compensado quando a gravação de metadados falha; monitorar e limpar órfãos caso a compensação também falhe.

Contratos: valores decimais exatos, datas civis, um ACTIVE por imóvel protegido por índice único e transação. Partes precisam ser do tipo correto e ativas para contratos não encerrados. Desativar pessoa com contrato ativo retorna 409. Encerrar contrato antigo continua permitido após mudança do imóvel para venda. Vencimentos 29–31 ficam apenas registrados; ajuste do calendário pertence à futura cobrança. Não excluir contratos nem apagar pessoas vinculadas; exclusão de imóvel vinculado é impedida por FK.

## 2026-09-12 — Comissão de captação equivalente a um aluguel (regra provisória)

Para a próxima etapa, a comissão de captação será modelada como o valor de um aluguel do contrato, com parcelamento configurável e confirmação manual de cada parcela. O backend deve calcular o total com decimal exato, persistir parcelas e expor total pago/saldo para o painel ADMIN. Essa regra veio do relato operacional do dono e precisa ser validada contabilmente; não é uma afirmação jurídica nem uma taxa percentual presumida.

Comissão de captação e repasse mensal são fluxos distintos. Não misturar as tabelas, não aplicar comissão automaticamente a multas/juros e não presumir retenções, impostos ou integrações bancárias sem decisão posterior. SI9/Imonov continuam fora do escopo.

Operação: migration aditiva 1789257600000; não altera migrations anteriores e não roda automaticamente. Backup e validação do histórico do Neon são pré-requisitos de aplicação. Nenhum .env encontrado nos dois checkouts desta sessão; não foram reconstruídas credenciais nem escritos dados no Neon/R2. A migration de hardening preexistente 1789084805000 continua fora do data-source como estava: revisar seu histórico separadamente antes de aplicá-la, sem presumir que foi executada.

Correção de compatibilidade: mensagens do filtro global da API agora seguem string/lista em message, como esperado pelo front. Busca parcial por título foi adicionada somente ao DTO do catálogo administrativo para seleção de imóveis; contrato público/SSR preservado.


## 2026-09-13 — URLs públicas e indexação (Codex)
Plano aprovado: finalidades para-alugar/para-comprar e tipos salas/lojas/galpoes/predios/terrenos em /imoveis; cidade, preco-minimo, preco-maximo e pagina na query. Slugs estáveis e endpoints da API preservados. Aliases administrativos login -> entrar e leads -> contatos, com 301 no SSR e replace no cliente. Filtros continuam noindex,follow. Dono autorizou SITE_URL=https://corretor-web-test.vercel.app e SEO_INDEXABLE=true em Production da Vercel; API_ORIGIN existente deve ser HTTPS; previews bloqueados. Não alterar banco, storage ou permissões.

## 2026-09-13 — Infraestrutura de mídia R2
A pedido do dono, criado bucket corretor-midia com acesso r2.dev público para imagens e vídeos do catálogo. R2_PUBLIC_URL do Render atualizado para o domínio desse bucket, preservando as demais variáveis. Documentos permanecem em corretor-documentos-test: acesso público r2.dev encontrado ativo e desativado. Não usar o bucket de documentos como base pública de mídia.

## 2026-09-13 — Listagem pública retorna mídia via segunda query (opencode)

Decisão: `PropertiesService.list()` anexa as mídias com uma segunda consulta (`propertyId In (...)`, ordenada por `orderIndex`), em vez de incluir a relação one-to-many no `findAndCount`.

Motivo: o join dentro do `findAndCount` duplica linhas de imóvel e quebra a paginação; sem a mídia, o cartão do catálogo cai sempre no "Foto em breve" enquanto o detalhe exibe a capa.

Não fazer:

- Não voltar a relação `media` para dentro do `findAndCount` com `take`: a paginação volta a contar linhas do join.
- Não criar campo novo (`coverUrl`) sem necessidade: o contrato `media[]` com `isCover` já atende o front e o SEO.

## 2026-09-13 — Perfil próprio via /auth/me com whitelist (opencode)

Decisão: PATCH /auth/me aceita só 
ame, whatsappNumber, creci e vatarUrl (UpdateProfileDto);
PATCH /auth/me/password troca a senha exigindo a atual. O id vem sempre do JWT (iewer.id), nunca do body.
E-mail, papel e ativo continuam exclusivos do PATCH /agents/:id (só ADMIN).

Motivo: corretor precisa editar foto e dados sem virar ADMIN; liberar o PATCH /agents/:id para não-ADMIN
abriria elevação de papel e troca de e-mail de outro usuário.

Não fazer:

- Não aceitar email, 
ole, ctive ou password no PATCH /auth/me: o pipe global (whitelist +
  orbidNonWhitelisted) já devolve 400, e o DTO nem declara esses campos.
- Não criar rota de perfil por :id para o próprio usuário: o JWT já identifica o dono.

## 2026-09-13 — Troca/reset de senha sem revogar sessões (opencode)

Decisão: changePassword e o reset via PATCH /agents/:id trocam só o hash (argon2id); as sessões de refresh
existentes não são revogadas. O aviso no diálogo de reset informa que o acesso atual do alvo segue válido até
sair ou o token expirar.

Motivo: SessionService só revoga por token individual; revogar "todas menos a atual" exigiria buscar o hash
da sessão corrente no controller e novo método com suporte no fixture — custo desproporcional ao benefício agora.

Não fazer:

- Não presumir logout remoto após reset: avisar a pessoa e, se preciso, pedir para ela sair e entrar de novo.
- Não logar senha em lugar nenhum (código, teste, changelog ou docs).

## 2026-09-13 — Filtro status só no gerenciado (opencode)

Decisão: status? existe apenas no ManagedPropertyQueryDto; o PropertyQueryDto público continua sem ele
(e o pipe global responde 400 a ?status= no público).

Motivo: o painel precisa das métricas por disponível/reservado/concluído; o catálogo público só lista
DISPONIVEL e o contrato do SSR não muda.

Não fazer:

- Não adicionar status ao DTO público nem ao 
eadCatalogQuery do front sem decisão nova de SEO/produto.

## 2026-09-14 — Modelo integral português e corte coordenado (Codex)

Pedido integral de 13/09/2026 e escolha de Drive compartilhado pelo dono substituem o MVP anterior. Referência normativa: docs/specs/2026-09-13-backend-integral.md; execução e contrato: docs/handoffs/2026-09-14-backend-portugues.md.

- Domínio ativo em português, DTOs/colunas snake_case, auditoria universal; classificação dinâmica e tags relacionais. NestJS/TypeORM/class-validator permanecem, sem dependência nova.
- Exclusão lógica com ativo (inclui associações e finanças). Exceções técnicas: mídia excluída no R2/banco; refresh consumido/expurgado. Não apagar histórico de contratos nem simular consentimento em cadastro manual.
- Dados pessoais em colunas reais pesquisáveis. Cifra antiga é lida exclusivamente pela migração; conservar chave original até verificar os dados e o backup. Não usar criptografia de coluna no runtime novo.
- Contratos por ADMIN/intermediador, sem trava de finalidade. Partes são alteradas por ADMIN; corretor lê apenas as vinculadas aos próprios contratos. Receita é comissão de venda/locação informada manualmente, com até 600 parcelas; não presumir valor de um aluguel, repasse mensal, integração bancária ou comissão de corretor.
- Drive via Service Account em Drive compartilhado privado (escolha expressa do dono). Quatro GOOGLE_DRIVE_* juntas; OAuth/HTTP nativos, IDs reservados e retentativa sem duplicação. Falha externa preserva contrato com estado explícito. Sem credenciais reais, marcar homologação Workspace pendente.
- Migration nova preserva tabelas antigas em legado_20260913 e aborta se faltarem CPF/complementos reais. Clientes manuais explícitos suportam comissões antigas sem leads. Nenhum documento histórico do R2 é removido. Alterações aplicadas são imutáveis; não executar migration direto em produção sem backup/restauração validados e corte coordenado.
- Comandos de migration agora usam executor com logs sanitizados e MIGRACAO_BACKUP_ARQUIVO para escrita. Não imprimir QueryFailedError, SQL com parâmetros ou detalhes de linhas decifradas.
- Cookie Secure/Strict/HttpOnly em todos ambientes; desenvolvimento de navegador exige HTTPS. API nova é incompatível com o contrato frontend antigo: adaptar cliente, SSR e painel antes do deploy conjunto. Ajustar health check Render para /api/v1/saude nesse corte.
- Homologação usa database vazia homologacao_pt na branch Neon br-ancient-sound-a5tsf5rf, PostgreSQL 16.15; testes transacionais são revertidos. Banco/API publicados permanecem intactos. Manter branch de homologação identificada até o dono definir retenção.

## 2026-09-16 — Hardening dos achados confirmados da auditoria

Rotas administrativas de tipos, finalidades e características exigem `AutenticacaoGuard` e
`CargosGuard` com cargo `ADMIN`; corretores continuam podendo ler o que o produto autoriza,
mas não alteram a classificação global do catálogo. Após troca de senha, todas as sessões de
refresh do corretor são revogadas por uma única operação parametrizada no banco. Em produção,
`ALLOWED_ORIGINS` deve conter somente origens HTTPS.

Não fazer: editar migrations aplicadas, apagar dados de teste sem autorização, ou adicionar
Redis/alterar `trust proxy` sem decisão de infraestrutura e topologia.

## 2026-09-16 — Ids inteiros, pessoas unificadas e ficha do imóvel (Claude)

Decisão do dono em 16/09/2026: nenhuma tabela usa mais UUID; todo `id` é inteiro gerado pelo banco
(`GENERATED BY DEFAULT AS IDENTITY`), o que simplifica consultas e permite filtrar por id. O contrato
completo está em `docs/handoffs/2026-09-16-ids-inteiros-pessoas.md` (cópia do arquivo do front).

- `clientes` e `partes_locacao` viraram a tabela `pessoas`: o lead do site é só o primeiro contato de uma
  pessoa que depois pode ser cliente, proprietário ou inquilino. Não há `papel`; contrato e comissão apontam
  para `pessoas`. `status_contato` (`PENDENTE`, `RESPONDIDO`, `FINALIZADO`) alimenta as três colunas do painel.
- Imóvel: `valor` deu lugar a `valor_venda` e `valor_locacao` (ambos opcionais, os dois vazios = sob consulta);
  `status` passa a `DISPONIVEL | RESERVADO | VENDIDO | ALUGADO | RETIRADO`; campos internos opcionais
  (`proprietario_id`, `exclusividade`, `exclusividade_ate`, `data_captacao`, `chaves`, `matricula`,
  `inscricao_municipal`, `observacoes_internas`, `motivo_baixa`) só saem nas rotas `/admin`.
- Slug = título normalizado + id; muda com o título e a rota pública resolve pelo id no fim do slug.
- Catálogo: `bairro`, `area_min/max`, `destaque`, `ordenar` e `busca` em título/bairro/cidade/descrição ou por id.
  O preço de filtro/ordenação segue a finalidade (`valor_venda`, `valor_locacao` ou o primeiro informado).
- Migration `1789603200000-ids-inteiros-pessoas.ts` aditiva: arquiva o modelo anterior em `legado_20260916`,
  recria as tabelas e copia os dados mapeando UUID → inteiro. `down` recusa reversão. Validada com o teste de
  integração em PostgreSQL 16 local (`TESTE_LOCAL_DATABASE_URL`, Docker) além do caminho Neon existente.
- Regras de locação e comissão de 14/09 não mudaram; só apontam para `pessoas`. `DELETE` de contrato e
  comissão passou a responder 204 como os demais.

Não fazer: reintroduzir UUID em qualquer entidade; criar cadastros separados de pessoa por papel; expor os
campos internos do imóvel na rota pública; editar as migrations anteriores; executar a migration em banco
publicado sem backup e corte coordenado com o front (contrato antigo deixa de funcionar).
