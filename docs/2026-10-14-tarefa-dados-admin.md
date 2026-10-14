# Tarefa ADMIN-001 — Dados reais do administrador e limpeza do bootstrap

- **Status:** aberta, adiada pelo dono em 13/10
- **Responsável:** dono
- **Contexto:** em 17/09 o administrador foi recriado com **CPF de exemplo**, e as variáveis `BOOTSTRAP_ADMIN_*`
  (nome, e-mail, senha, WhatsApp e CPF) ficaram no `.env` local. A senha inicial em texto continua num arquivo da
  máquina.

## O que o dono precisa fazer

1. Entrar no painel como administrador e abrir **Perfil**.
2. Conferir nome, WhatsApp e CRECI. Trocar o que for de exemplo.
3. CPF: o Perfil não edita CPF, mas a API aceita a troca por ADMIN em `PATCH /admin/corretores/:id`, inclusive no
   próprio cadastro. Pelo painel, use **Corretores → editar**. Se a lista levar ao Perfil (o próprio cadastro abre
   como Perfil), outro ADMIN faz a troca, ou peça ao agente uma alteração pela API autenticada, sem mexer direto no
   banco. O CPF não pode aparecer em log, terminal ou documento.
4. Trocar a senha pelo Perfil, já que a inicial ficou no `.env`.
5. Apagar do `.env` local as cinco linhas `BOOTSTRAP_ADMIN_*` e conferir que não existem no Render.
   `npm run bootstrap:admin` só é necessário num banco novo.

## Validação (critério de conclusão)

- O cartão do corretor no site e o painel mostram o WhatsApp real.
- Entrar com a senha nova funciona, e a antiga não.
- O `.env` local e o ambiente do Render não têm nenhuma variável `BOOTSTRAP_ADMIN_*`.
- Marcar ADMIN-001 como concluída no `TASKS.md` e registrar no `CHANGELOG_AI.md`, sem citar CPF, senha ou WhatsApp.

## Não fazer

- Não colar CPF, senha ou WhatsApp em mensagem ao agente, em commit ou em documento.
