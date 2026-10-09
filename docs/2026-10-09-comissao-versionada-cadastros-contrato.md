# Comissão versionada, cadastros de contrato e entrega local (09/10/2026)

Entrega local nos dois repositórios, sem commit, push, deploy ou acesso ao Neon. A migration nova **não** foi
aplicada no banco real. Para aplicar, faça antes um backup verificado (ver `AGENTS.md`) e publique a API antes do front.

## O que mudou

### Comissão: CRUD completo com plano versionado
- `PATCH /admin/comissoes/:id` exige `versao_registro` e aceita os campos do `POST`: operação, contrato, imóvel,
  cliente, receita total, quantidade de parcelas, primeiro vencimento e observações, além de `ativo`.
- Só as **mudanças efetivas** contam. Reenviar os valores atuais não bloqueia salvar observações nem incrementa a versão.
- Versão divergente responde 409 e pede para recarregar a ficha. A baixa efetiva também incrementa `versao_registro`.
  O replay da baixa com o mesmo comprovante continua idempotente e não incrementa.
- Com qualquer parcela paga, mudanças financeiras ou de vínculo respondem 409. Observações, arquivamento e reativação
  continuam liberados. O recebimento é conferido de novo dentro da transação.
- Uma comissão arquivada aceita só observações e reativação.
- A reativação revalida imóvel, pessoa e contrato (ativos e autorizados) e responde 409 com o motivo. Ela reativa só
  as parcelas do plano vigente.
- Mudança financeira ou de vínculo cria um novo plano (`versao_plano + 1`). O plano anterior fica guardado, inativo.
  Listagens, saldos, o cron de atraso e a ficha consideram só o plano vigente.
- A baixa de uma parcela de plano substituído responde 409.
- `DELETE /admin/comissoes/:id` foi removido; arquivar é `PATCH {ativo:false, versao_registro}`. O front não usava o DELETE.
- Permissões preservadas. O ADMIN administra todas as comissões. O CORRETOR precisa estar autorizado à comissão atual e às
  referências novas. As regras de vínculo do `POST` foram extraídas para `validarVinculos` e são reaproveitadas na
  edição e na reativação.
- Travas: advisory lock `comissoes:integridade`, depois contratos, imóveis e pessoas, cada grupo em ordem de id.
- `GET /admin/comissoes/:id/revisoes` devolve o histórico com nomes do contrato, imóvel, pessoa e autor, com a mesma
  autorização da ficha.
- A ficha (`GET /admin/comissoes/:id`) passa a trazer `versao_plano`, `versao_registro`, `possui_recebimento` e
  `primeiro_vencimento`.

### Índices de reajuste e tipos de contrato
- CRUD do ADMIN em `/admin/indices-reajuste` e `/admin/tipos-contrato`, com paginação e busca. A desativação é lógica,
  por `PATCH {ativo}`.
- Opções ativas em `/cadastros/indices-reajuste` e `/cadastros/tipos-contrato`, autenticadas, para ADMIN e CORRETOR.
  Ficam fora do catálogo público e do SSR.
- O nome é único sem acento e sem caixa, inclusive entre inativos; um nome repetido responde 409 sugerindo reativar.
  A periodicidade é um inteiro de 1 a 600 meses.
- Os catálogos começam vazios e o ADMIN os preenche.

### Contratos
- O `POST` exige `tipo_contrato_id` e `indice_reajuste_id` ativos. O texto livre `indice_reajuste` deixa de ser aceito
  do cliente e passa a ser uma cópia do nome do índice.
- Snapshot no contrato: `tipo_contrato_nome`, `indice_reajuste_nome`, `indice_reajuste_periodicidade_meses` e
  `indice_reajuste_regra`. Ele só é refeito quando o id escolhido muda. Renomear o cadastro não altera contratos.
  Uma referência desativada continua no contrato.
- Contrato legado (referências nulas) mantém o texto atual até ser classificado. **Por decisão do dono**, qualquer
  edição de contrato legado exige classificar. O arquivamento (`DELETE`) é a exceção. Ao classificar, o texto anterior
  é substituído pelo nome do índice.

### Outros
- `IdRegistro` limitado a 2147483647 (int4) em todos os DTOs. Antes, `imovel_id` e `pessoa_id` de pessoas-elegíveis
  (e outros ids) aceitavam valores maiores e chegavam ao banco como erro 500.

## Migration `1789689600000-comissao-versionada-cadastros-contrato`
- `comissoes`: `versao_plano` e `versao_registro`, ambas com padrão 1.
- `parcelas_comissao`: coluna `versao_plano`. A unicidade antiga (localizada pela definição, não pelo nome) dá lugar
  a `parcelas_comissao_plano_numero (comissao_id, versao_plano, numero_parcela)`.
- `comissao_revisoes`: tabela com trigger que recusa `UPDATE` e `DELETE`. Recebe um backfill v1 por comissão
  (`origem = 'MIGRACAO'`, `autor_id` nulo, primeiro vencimento igual ao menor vencimento das parcelas).
- Tabelas `indices_reajuste` e `tipos_contrato`, com `nome_normalizado` único.
- `contrato`: referências nulas, snapshots e CHECKs de coerência entre referência e snapshot.
- Não recalcula parcelas nem pagamentos. O `down()` recusa a reversão, no mesmo padrão das duas anteriores.

## Validação (resultados reais de 09/10)
- **API:** typecheck, lint e build aprovados. `npm test` não foi executado: não há suítes (TEST-API).
- **Front:** typecheck e build aprovados. O lint dá 0 erros e 2 avisos que já existiam em `Catalogo.tsx`. `npm test`
  passa 23/23. O smoke de SSR passa com a asserção nova do slogan.
- **Migration** em PostgreSQL 16 descartável (Docker) com legados (comissão com pagamento, sem pagamento e arquivada;
  contrato com texto livre): 17/17. Inclui IDs, textos, parcelas e pagamentos intactos, revisões v1, trigger
  imutável, unicidade nova, CHECKs e catálogos vazios.
- **QA HTTP** com módulos reais: 62/62. Cobriu:
  - permissões por cargo e nomes duplicados;
  - referência inativa, contrato legado e obrigatoriedade no contrato novo;
  - snapshot preservado ao renomear;
  - limites de id e bloqueio após recebimento;
  - valores iguais com observação, versão desatualizada e DELETE removido;
  - novo plano, histórico e baixa de parcela substituída;
  - idempotência, arquivamento, reativação com revalidação;
  - 6/6 corridas de edição × baixa concorrentes, com exatamente uma vencendo;
  - duas edições com a mesma versão.
- **Navegador** (Chrome headless, API completa com login real): 37/37. Cobriu:
  - Cadastros por cargo, grupos, categoria preservada no botão Voltar, no Esc e no voltar do navegador;
  - formulários de contrato, legado e orientação sem opções;
  - edição completa de comissão, conflito de versão, arquivar/reativar e só observações após recebimento;
  - tema escuro, 390 e 320 px sem rolagem horizontal, e SSR com o slogan.

Os roteiros ficaram fora do repositório, sem ampliar as suítes rastreadas.

## Pendências
- Aplicar a migration no Neon, só em etapa autorizada e com backup verificado. Depois publicar a API e, em
  seguida, o front.
- O front novo depende da API nova: contratos não salvam contra a API antiga (o campo `indice_reajuste` mudou).
- Cadastrar tipos de contrato e índices de reajuste no ambiente real antes de criar contratos.
