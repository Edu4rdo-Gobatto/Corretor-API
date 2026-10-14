# Tarefa LOGS-001 — Conta de monitoramento de erros

- **Status:** aberta, depende do dono. A parte sem conta já foi feita em 14/10: logs em JSON quando
  `NODE_ENV=production`.
- **Responsável:** dono (conta) e depois um agente (integração)
- **Por quê:** hoje um erro em produção só aparece se alguém abrir o log do Render. Não há alerta nem histórico
  agrupado.

## Decisão a tomar antes

| Opção | O que exige | Observação |
|---|---|---|
| **Sentry** (recomendado) | conta gratuita, projeto Node, DSN | agrupa exceções e alerta por e-mail; integração exige a dependência `@sentry/nestjs` (registrar no `DECISIONS.md`) |
| **Better Stack (Logtail)** | conta gratuita, source token | recebe os logs JSON do Render por *log drain*, sem mudar código |
| Só o Render | nada | sem alerta; continua como hoje |

## O que o dono precisa fazer

- **Sentry:** criar a conta e um projeto **Node.js / NestJS**, copiar o **DSN** e cadastrar no Render a variável nova
  `SENTRY_DSN`. Depois pedir ao agente a integração: dependência, inicialização no `main.ts`, envio pelo
  `GlobalExceptionFilter` só de erros 5xx, sem corpo de requisição nem dados pessoais, e a variável validada como
  opcional no `env.validation.ts` e no `.env.example`.
- **Better Stack:** criar a conta e uma *source* do tipo HTTP e, no Render (serviço → Logs → **Log Streams**),
  apontar para o endpoint indicado. Não exige variável nem código.

## Validação (critério de conclusão)

- Provocar um erro 500 controlado no ambiente de teste e ver o evento chegar com rota, status e horário, **sem**
  e-mail, CPF, telefone, token ou senha.
- Configurar um alerta por e-mail para erros novos.
- Registrar a escolha no `DECISIONS.md` e o resultado no `CHANGELOG_AI.md`.

## Não fazer

- Não enviar corpo de requisição, cabeçalho `Authorization`, cookies ou dados de pessoas ao serviço externo.
