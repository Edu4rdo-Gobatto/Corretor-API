# Tarefa DRIVE-001 — Pastas de contrato no Meu Drive do dono

- **Status:** código pronto (16/10, OAuth no Meu Drive); falta o dono criar o cliente OAuth, autorizar e homologar
  (parte do AUDIT-001)
- **Responsável:** dono (Google Cloud e autorização)
- **Bloqueia:** a criação automática da pasta privada de cada contrato. Sem as variáveis, o contrato é salvo com
  `status_pasta_drive = FALHOU` e o painel oferece "Tentar preparar pasta novamente".
- **Decisão:** [DECISIONS.md](DECISIONS.md), 16/10. Até 16/10 a integração exigia Drive compartilhado (Workspace).

## O que o dono precisa fazer (uma vez)

1. Criar o projeto: <https://console.cloud.google.com/projectcreate> (nome sugerido: `corretor-drive`).
2. Ativar a API, com o projeto selecionado: <https://console.cloud.google.com/apis/library/drive.googleapis.com>.
3. Tela de consentimento: <https://console.cloud.google.com/auth/branding>. Tipo **Externo**, nome do app e o seu
   e-mail de suporte e de contato.
4. Publicar o app: <https://console.cloud.google.com/auth/audience> → **Publicar app**. Em "Teste" o refresh token
   expira em 7 dias.
5. Criar o cliente: <https://console.cloud.google.com/auth/clients> → **Criar cliente** → tipo **App para
   computador**. Copiar o **ID do cliente** e a **Chave secreta** para o `.env` da API:

   ```
   GOOGLE_DRIVE_CLIENT_ID=<termina em .apps.googleusercontent.com>
   GOOGLE_DRIVE_CLIENT_SECRET=<chave secreta>
   ```

6. Na pasta da API, rodar `npm run drive:autorizar`. Abrir o endereço impresso, entrar com a conta dona do Drive e,
   no aviso "O Google não verificou este app", clicar em **Avançado → Acessar** e permitir.
7. O comando cria a pasta `Corretor - Contratos` no Meu Drive e imprime duas linhas. Colar no `.env`:

   ```
   GOOGLE_DRIVE_REFRESH_TOKEN=...
   GOOGLE_DRIVE_ROOT_FOLDER_ID=...
   ```

8. Reiniciar a API. As quatro variáveis vão juntas: com só parte delas, a API não inicia. No Render, cadastrar as
   mesmas quatro.

## Validação (critério de conclusão)

- Criar um contrato ativo no painel: a resposta volta com `status_pasta_drive = CRIADA` e o link abre
  `Corretor - Contratos / Imobiliária / Contratos / <número> - <locatário>`.
- Renomear o número do contrato e confirmar que a pasta é renomeada, não duplicada.
- "Tentar preparar pasta novamente" devolve a mesma pasta.
- Abrir o link numa janela anônima ou com outra conta: o acesso precisa ser negado.
- Registrar no `CHANGELOG_AI.md` e marcar o item do Drive no AUDIT-001 do `TASKS.md`.

## Se der `FALHOU`

O 503 da API é genérico de propósito. Causas prováveis: Drive API não ativada; app em "Teste" (token vencido após
7 dias); acesso revogado em <https://myaccount.google.com/permissions>; pasta raiz apagada, movida para a lixeira ou
compartilhada por link. Para refazer a autorização, rodar `npm run drive:autorizar` de novo e trocar as duas linhas.

## Não fazer

- Não comitar o `.env` nem colar o refresh token em chat, log ou documento: ele dá acesso às pastas criadas pela API.
- Não apagar `Imobiliária` e `Contratos` depois da primeira criação: os ids ficam no `registro_pasta_drive` e um id
  apagado não volta. Trocar a raiz (rodar `npm run drive:autorizar` de novo e usar a pasta nova) serve para
  contratos novos; contratos que já têm pasta registrada passam a falhar na repetição, porque o registro aponta para
  a raiz antiga. Para só renovar o token, mantenha o `GOOGLE_DRIVE_ROOT_FOLDER_ID` atual e apague a pasta extra criada.
- Não compartilhar a pasta raiz por link: a API recusa pasta com acesso `anyone` ou `domain`.
