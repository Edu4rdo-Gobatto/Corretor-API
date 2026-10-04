# Backend em português — entrega e migração

Especificação normativa: [pedido integral](../specs/2026-09-13-backend-integral.md). Este documento substitui as regras conflitantes do MVP de 12/09, preservadas no histórico. Código na `main`, ainda sem commit/publicação.

## Contrato HTTP

A API mantém o prefixo `/api/v1`. A compatibilidade sem prefixo do servidor continua disponível para o proxy SSR. Os caminhos abaixo omitem esse prefixo.

| Área | Rotas | Acesso |
|---|---|---|
| Saúde | `GET /saude` | Público, sem dados de negócio |
| Sessão | `POST /autenticacao/entrar`, `/renovar`, `/sair`; `GET/PATCH /autenticacao/eu`; `PATCH /autenticacao/eu/senha` | Login público com limite/origem; perfil JWT |
| Corretores | `GET/POST /admin/corretores`; `GET/PATCH/DELETE /admin/corretores/:id` | ADMIN |
| Classificações | `GET /tipos-imovel`, `/finalidades-imovel`, `/caracteristicas`; CRUD correspondente sob `/admin` | Leitura pública de ativos; gestão autenticada |
| Imóveis | `GET /imoveis`, `/imoveis/:slug`; CRUD `/admin/imoveis` | Interno: todos leem; dono/ADMIN escreve |
| Mídia | `POST /admin/imoveis/:imovel_id/midias`; `POST .../video-embed`; `PATCH .../ordem`; `PATCH .../:midia_id/capa`; `DELETE .../:midia_id` | Dono/ADMIN |
| Clientes | `POST /clientes`; CRUD `/admin/clientes` | Público com consentimento; interno próprio atendente/ADMIN |
| Partes | CRUD `/admin/partes-locacao` | Escrita ADMIN; corretor lê somente partes de seus contratos |
| Contratos | CRUD `/admin/contratos`; `POST /admin/contratos/:id/pasta-drive` | Intermediador/ADMIN |
| Comissões | CRUD `/admin/comissoes`; `PATCH /admin/comissoes/parcelas/:id/pagamento` | ADMIN ou responsável pelo imóvel e atendimento |

`DELETE` desativa entidades de negócio; `PATCH {"ativo":true}` reativa. Mídia é removida do R2 e do banco. Sessões são consumidas/expurgadas fisicamente como exceção técnica. As relações de características também usam `ativo`.

Payloads e campos persistidos usam português e `snake_case`. Listagens usam `itens`, `total`, `pagina`, `limite` (algumas também retornam `total_paginas`). Catálogo aceita `tipo_id`, `finalidade_id`, `cidade`, `valor_min`, `valor_max`, `busca`; tipos/finalidades são IDs cadastrados. Upload usa campo multipart `arquivos`; ordem usa `midias_ids`.

Login recebe `{ "email": "...", "senha": "..." }` e retorna `token_acesso`, `tipo_token`, `corretor`. Cookie `corretor_renovacao`: HttpOnly, Secure e SameSite=Strict inclusive em desenvolvimento; o uso pelo navegador exige HTTPS. JWT usa cargo atual do banco. Troca/reset de senha mantém as sessões já abertas, conforme a decisão anterior; não presumir logout remoto. Rate limits são por processo: distribuir a API entre réplicas requer infraestrutura compartilhada para um limite global.

Valores de aluguel, taxa e comissões são strings decimais com duas casas. Comissão recebe `tipo_operacao`, `contrato_id` para locação, `imovel_id`, `cliente_id`, `valor_total`, `quantidade_parcelas`, `primeiro_vencimento`. O total é informado pelo usuário, sem presumir um aluguel ou gerar cobrança mensal. Até 600 parcelas por criação; o limite contém uso de CPU/transação. Centavos restantes vão às primeiras parcelas; vencimentos 29–31 ajustam ao último dia sem deslocar os meses seguintes. Baixa exige `confirmar_pagamento:true` e `observacao_pagamento` com referência do comprovante (mínimo 5 caracteres). Repetir a mesma baixa é idempotente; comprovante diferente para parcela paga retorna conflito.

Jobs: expurgo de sessões a cada hora; contratos vencidos e parcelas atrasadas a cada hora, com atualização também ao consultar. Datas de negócio usam `America/Cuiaba`. Alterações de partes/contratos e financeiro são transacionais, com locks de integridade. Índice único parcial garante um contrato ATIVO por imóvel.

## Google Drive compartilhado

Configurar em conjunto `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY` (RSA >=2048 bits), `GOOGLE_DRIVE_ROOT_FOLDER_ID` e `GOOGLE_DRIVE_SHARED_DRIVE_ID`. A Drive API precisa estar habilitada; a Service Account deve ser membro do Drive compartilhado com permissão de criar/renomear pastas. A raiz deve ser privada e pertencer ao Drive informado. Não passar credenciais pelo chat nem pelo frontend.

Abaixo da raiz configurada, o serviço cria `Imobiliária/Contratos/{numero_contrato} - {locatario}`. Não cria permissões públicas: recusa `anyone` e `domain`, inclusive permissões herdadas retornadas pela API. Acesso é por usuários/grupos autorizados do Workspace.

`pastas_drive` reserva o ID gerado pelo Google antes da criação remota. Retentativas usam o mesmo ID, tratam 409 como possível criação anterior e conferem pasta/Drive/pai/permissões. Mudança de número/locatário renomeia a mesma pasta. OAuth RS256 e HTTP usam bibliotecas nativas; nenhuma dependência nova. Timeouts, 429/5xx e renovação de token são tratados sem registrar segredos.

Falha do Drive preserva o contrato salvo e retorna `status_pasta_drive=FALHOU`; use a rota de retentativa, não crie outro contrato. A configuração do Drive pode estar ausente durante o boot; nesse caso a integração falha de forma explícita. Credenciais reais e criação no Workspace ainda precisam de homologação externa.

Referências técnicas usadas: [Service Accounts](https://developers.google.com/identity/protocols/oauth2/service-account), [Drive compartilhado](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives), [criação e IDs pré-gerados](https://developers.google.com/workspace/drive/api/guides/create-file).

## Migração com preservação do legado

Migration nova `1789516800000-modelo-portugues.ts`. Nenhuma migration anterior foi editada. `synchronize=false` e `migrationsRun=false`. `typeorm_migrations` permanece com seu nome técnico para preservar o histórico aplicado. A migration de hardening preexistente nunca esteve registrada no CLI deste checkout e permanece fora da lista; não aplicar por suposição.

Antes do corte: parar escritores/API antigos, gerar backup completo, testar restauração em ambiente separado e preencher os complementos. A migration adquire locks nas tabelas de origem; ausência de campo obrigatório, cifra inválida ou violação de constraint aborta toda a transação. Não utiliza dados inventados.

`MIGRACAO_COMPLEMENTOS_ARQUIVO` aponta para JSON privado local, fora do Git, contendo:

```json
{
  "corretores": { "UUID_EXISTENTE": { "cpf": "CPF_REAL_VALIDO" } },
  "responsavel_migracao": "UUID_DE_CORRETOR_EXISTENTE",
  "contratos": {
    "UUID_CONTRATO_LEGADO": {
      "corretor_id": "UUID_EXISTENTE",
      "taxa_administracao": "8.00",
      "garantia_locaticia": "GARANTIA_REAL",
      "indice_reajuste": "INDICE_REAL",
      "cobranca_iptu_condominio": "REGRA_REAL"
    }
  },
  "clientes_manuais": {
    "UUID_NOVO_DE_CLIENTE": {
      "nome": "NOME_REAL",
      "telefone": "TELEFONE_REAL",
      "corretor_id": "UUID_EXISTENTE"
    }
  },
  "comissoes": { "UUID_COMISSAO_LEGADA": { "cliente_id": "UUID_LEAD_EXISTENTE_OU_CLIENTE_MANUAL" } }
}
```

Use somente valores reais; o exemplo é estrutural, não deve ser executado literalmente. `clientes_manuais` atende comissões antigas sem leads e sempre grava origem MANUAL/consentimento falso. CPF é necessário para cada corretor antigo. Contratos antigos precisam de seus novos campos de negócio. `responsavel_migracao` atribui a importação técnica das mídias cuja autoria histórica não existia no modelo, sem afirmar quem fez o upload original. Preservam-se IDs, hashes Argon2, slugs, datas e vínculos.

`LEADS_ENCRYPTION_KEY` original só é necessária durante a leitura dos registros cifrados antigos. Ela não é necessária ao runtime novo. Nunca trocá-la antes de concluir a migração e verificar o backup. Campos privados são decifrados e gravados em colunas reais; características JSON são convertidas em relações.

Os comandos `npm run migration:show`, `migration:run` e `migration:revert` usam um executor próprio que não imprime consultas, parâmetros ou detalhes de linhas rejeitadas. Para escrita, `MIGRACAO_BACKUP_ARQUIVO` precisa apontar para backup local não vazio. Não usar diretamente a CLI TypeORM antiga durante esta conversão: ela pode imprimir objetos de erro contendo parâmetros.

Ao final, as tabelas antigas e seus enums passam para `legado_20260913`, sem acesso via API. Isso inclui documentos, pagamentos de aluguel e dados cifrados históricos. Nenhum objeto de documentos no R2 é apagado; transferência histórica para o Drive deve ser planejada separadamente. Novos contratos usam exclusivamente Drive; o software não registra repasses mensais. Sessões antigas ficam no arquivo e exigem novo login.

`down` recusa reversão destrutiva. Rollback operacional requer restaurar o backup validado em banco separado e coordenar API/frontend; não apagar dados criados depois do corte.

## Publicação e frontend

O frontend atual ainda consome endpoints/campos ingleses e o financeiro antigo. Esta alteração de backend **não deve ser publicada isoladamente**. Próxima entrega precisa adaptar `src/services/api.ts`, autenticação, seletores dinâmicos, cadastros, contratos, comissões e SSR antes de publicar os dois juntos. O plano e a especificação foram sincronizados entre os repositórios; código de UI não faz parte deste pedido.

A API publicada e o banco principal não foram migrados. A homologação criou a branch Neon `homologacao-backend-portugues-20260913` (`br-ancient-sound-a5tsf5rf`) no projeto `corretor-db-test`, com uma database nova `homologacao_pt`. Testes usam PostgreSQL 16.15/TLS direto e revertem sua transação; a branch contém a cópia herdada do ambiente de teste e deve seguir a política de retenção do dono. Nunca confundir database isolada com apenas `SET search_path`.

## Validação

Resultados finais são registrados em `CHANGELOG_AI.md`. Suíte local, typecheck, lint, build e teste integrado Neon cobrem o código entregue. R2 real (novo fluxo), Workspace real, aplicação no banco publicado e frontend adaptado continuam fora da homologação desta entrega. Compensações R2 cobrem erros retornados, mas um encerramento abrupto entre storage e commit pode exigir conciliação de objetos órfãos.

No deploy coordenado, alterar também o health check do Render para /api/v1/saude (ou /saude). A rota antiga /health foi substituída; o serviço publicado não foi alterado nesta entrega.
