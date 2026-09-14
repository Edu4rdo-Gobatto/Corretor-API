# Refatoração integral do backend — plano de implementação

**Objetivo:** implementar a especificação integral enviada pelo dono em 13/09/2026, com domínio e contrato HTTP em português, substituindo o MVP anterior.
**Arquitetura:** módulos NestJS por domínio, TypeORM com migrations explícitas, DTOs class-validator, acesso por cargo e titularidade, valores monetários em strings decimais. Migração transacional preserva o legado fora do schema operacional, sem editar migrations aplicadas ou executar alterações no Neon nesta implementação.
**Stack:** NestJS 11, TypeScript estrito, TypeORM 0.3/PostgreSQL 16, Argon2id, R2 e Google Drive REST.
**Especificação:** `docs/specs/2026-09-13-backend-integral.md` (pedido integral do dono).

## Contratos entre agentes

- Codex principal: `src/comum`, `src/clientes`, migrations, configuração, bootstrap, integração e documentação dos dois repositórios.
- Codex autenticação: `src/autenticacao`, `src/corretores`; exporta `Corretor`, `CargoCorretor`, `AutenticacaoModule`, `CorretoresModule`, `AutenticacaoGuard`, `CargosGuard`, `Cargos`.
- Codex catálogo: `src/imoveis`, `src/midias`, `src/cadastros`; exporta `Imovel`, `ImovelMidia`, `TipoImovel`, `FinalidadeImovel`, `Caracteristica`, `ImovelCaracteristica` e respectivos módulos.
- Codex locações: `src/locacoes`, `src/comissoes`, `src/drive`; exporta `ParteLocacao`, `Contrato`, `Comissao`, `ParcelaComissao`, `LocacoesModule`, `ComissoesModule`.
- Compartilhado: `src/comum/auditoria.entity.ts` contém `Auditoria`; `src/comum/usuario-autenticado.ts` contém `UsuarioAutenticado { id, nome, email, cargo: 'ADMIN' | 'CORRETOR' }`. Propriedades persistidas e DTOs em snake_case português. Requisições autenticadas usam `request.user`.
- Novos módulos usam apenas o domínio novo. Diretórios anteriores permanecem temporariamente durante a implementação e serão retirados do runtime na integração.

## Etapas e critérios

- [x] 1. Preparar migration nova com tabelas, auditoria, FKs, CHECKs, índices de busca e unicidade parcial de contrato ativo; nunca fabricar dados ausentes do legado.
- [x] 2. Implementar entidades relacionais, DTOs, paginação e validação de documentos/telefones/datas/valores.
- [x] 3. Autenticação e corretores: rotação atômica, cookies seguros, limpeza horária e trava do último ADMIN.
- [x] 4. Catálogo dinâmico e mídia: visibilidade pública, leitura interna compartilhada, escrita por responsável/ADMIN, upload e exclusão R2, transações para capa/ordem.
- [x] 5. Clientes: consentimento público, cadastro manual, privacidade por atendimento, busca e soft delete.
- [x] 6. Partes/contratos: dados em colunas reais, bloqueios transacionais, vencimento automático, Drive com criação idempotente e tratamento de falha.
- [x] 7. Comissões: venda/locação, geração mensal em centavos exatos, atraso automático e baixa manual autorizada.
- [x] 8. Integrar módulo principal/configuração/CLI, remover runtime antigo e atualizar especificações/documentação sem apagar o histórico.
- [x] 9. Executar typecheck, lint, Jest e build; validar migration e rotas HTTP com cenários de autorização, limites e concorrência; registrar limites da homologação externa.

## Decisões de execução

O pedido já autoriza implementação completa; não há nova pausa para aprovar o mesmo escopo. Sem commit/push/deploy nesta solicitação. Novo contrato HTTP exige adaptação posterior do frontend antes de publicação conjunta. Segredos do Drive são configurados no ambiente; testes usam transporte controlado. Desativação usa `ativo`, incluindo tabelas associativas e financeiras, conforme a regra global. Sessões são a exceção técnica à retenção (consumo/expiração requer DELETE).

