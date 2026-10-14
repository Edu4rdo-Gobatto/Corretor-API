# Tarefa DRIVE-001 — Credenciais reais do Google Drive para as pastas de contrato

- **Status:** aberta, depende do dono (parte do AUDIT-001)
- **Responsável:** dono (Google Cloud e Google Workspace)
- **Bloqueia:** a criação automática da pasta privada de cada contrato. Sem as variáveis, o contrato é salvo com
  `status_pasta_drive = FALHOU` e o painel oferece "Tentar preparar pasta novamente". Nada foi homologado com
  credenciais reais.

## O que o dono precisa fazer

1. No Google Cloud Console, criar (ou escolher) um projeto e ativar a **Google Drive API**.
2. Criar uma **conta de serviço** e gerar uma chave **JSON**. Guardar o arquivo fora do repositório.
3. Ter um **Drive compartilhado** (exige Google Workspace) e adicionar o e-mail da conta de serviço como membro com
   papel **Gerente de conteúdo**.
4. Dentro dele, criar a pasta raiz dos contratos. A API recusa pasta que não seja privada.
5. Cadastrar no Render (e no `.env` local) as quatro variáveis, **sempre juntas**:

   | Variável | De onde vem | Validação da API |
   |---|---|---|
   | `GOOGLE_DRIVE_CLIENT_EMAIL` | `client_email` do JSON | e-mail válido |
   | `GOOGLE_DRIVE_PRIVATE_KEY` | `private_key` do JSON, com `\n` literais | chave RSA de no mínimo 2048 bits |
   | `GOOGLE_DRIVE_ROOT_FOLDER_ID` | id da pasta raiz (trecho final da URL da pasta) | letras, números, `_` e `-` |
   | `GOOGLE_DRIVE_SHARED_DRIVE_ID` | id do Drive compartilhado | letras, números, `_` e `-` |

## Validação (critério de conclusão)

- Criar um contrato ativo no painel: a resposta volta com `status_pasta_drive = CRIADA` e o link abre a pasta
  `Imobiliária / Contratos / <número> - <locatário>`.
- Renomear o número do contrato e confirmar que a pasta é renomeada, não duplicada.
- Acessar o link com uma conta fora do Drive compartilhado: o acesso precisa ser negado.
- Registrar no `CHANGELOG_AI.md` e marcar o item do Drive no AUDIT-001 do `TASKS.md`.

## Não fazer

- Não comitar o JSON da conta de serviço nem a chave privada.
- Não usar pasta do "Meu Drive" pessoal: a integração exige Drive compartilhado.
