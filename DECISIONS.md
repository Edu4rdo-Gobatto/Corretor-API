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
