@AGENTS.md

# Instruções específicas do Claude

Antes de responder ou modificar arquivos:

- Leia `docs/PROJECT_STATUS.md`, `docs/TASKS.md` e `docs/DECISIONS.md`.
- Leia o último registro de `docs/CHANGELOG_AI.md`.
- Confira o estado do Git e se a branch está sincronizada com o remoto.
- Em dúvida sobre regra de produto, consulte `corretor-spec.json` antes de propor mudança.

Durante o trabalho:

- Não confie em documento para afirmar o que existe: a fonte de verdade é o código.
- Mudanças em migration, variável de ambiente ou contrato de endpoint exigem registro em `docs/DECISIONS.md`.

Quando terminar:

- Atualize o status da tarefa em `docs/PROJECT_STATUS.md` e `docs/TASKS.md`.
- Registre decisões arquiteturais em `docs/DECISIONS.md`.
- Acrescente ao `docs/CHANGELOG_AI.md` a validação executada e o resultado real, incluindo falhas.
- Não considere uma tarefa concluída só porque o código compila: use os critérios de conclusão da tarefa.
- Diga o que ficou sem validação e o que depende de serviço externo.
