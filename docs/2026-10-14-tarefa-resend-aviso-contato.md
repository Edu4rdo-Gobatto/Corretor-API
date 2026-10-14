# Tarefa NOTIFY-001 — Conta no Resend para o aviso de novo contato

- **Status:** aberta, depende do dono
- **Responsável:** dono (criação de conta e DNS)
- **Bloqueia:** o envio real do e-mail ao corretor quando chega contato pelo site. O código está pronto (14/10) e,
  sem as variáveis, o aviso fica desligado sem afetar o cadastro do contato.

## O que o dono precisa fazer

1. Criar conta em <https://resend.com> (plano gratuito: 3.000 e-mails por mês, 100 por dia).
2. Em **Domains**, adicionar o domínio do site (ou um subdomínio, como `avisos.seudominio.com.br`) e publicar no DNS os
   registros que o Resend mostrar (SPF, DKIM e, de preferência, DMARC). Esperar o status **Verified**.
3. Em **API Keys**, criar uma chave com permissão **Sending access**, restrita ao domínio verificado.
4. No Render (serviço `Corretor-API` → Environment), cadastrar:

   | Variável | Valor | Validação da API |
   |---|---|---|
   | `RESEND_API_KEY` | chave criada no passo 3 | começa com `re_` |
   | `AVISO_EMAIL_REMETENTE` | `Nome <avisos@dominio-verificado>` ou só o e-mail | endereço do domínio verificado |

   As duas vão **juntas**: só uma delas faz a API recusar a inicialização.
5. Conferir que a **primeira** origem de `ALLOWED_ORIGINS` é o endereço público do site: o link "Abrir contatos no
   painel" do e-mail é montado com ela.

## Validação (critério de conclusão)

- Enviar um contato real pelo site num imóvel ativo. O corretor responsável recebe o e-mail com imóvel, nome,
  telefone e mensagem; "Responder" vai para o e-mail do visitante, quando informado.
- No painel do Resend, o envio aparece como **Delivered**. Conferir que não caiu no spam.
- Se falhar, o log do Render mostra `Aviso de novo contato não enviado (pessoa N)` com o status HTTP, sem dados
  pessoais.
- Registrar no `CHANGELOG_AI.md` a data do primeiro envio real e marcar NOTIFY-001 como concluída no `TASKS.md`.

## Não fazer

- Não comitar a chave nem colocá-la no `.env.example`.
- Não usar remetente de domínio não verificado (Gmail, Outlook etc.): o Resend recusa.
