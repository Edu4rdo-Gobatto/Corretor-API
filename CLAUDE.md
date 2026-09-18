@AGENTS.md

# Instruções específicas do Claude

Antes de responder ou modificar arquivos:

- Leia `PROJECT_STATUS.md`, `TASKS.md` e `DECISIONS.md`.
- Leia o último registro de `CHANGELOG_AI.md`.
- Confira o estado do Git e se a branch está sincronizada com o remoto.
- Em dúvida sobre regra de produto, consulte `corretor-spec.json` antes de propor mudança.

Durante o trabalho:

- Não confie no `README.md` nem no `PLANO-PROJETO-CORRETOR.md` para afirmar o que existe:
A fonte de verdade é o código.
- Mudanças em migration, variável de ambiente ou contrato de endpoint exigem registro em `DECISIONS.md`.

Quando terminar:

- Atualize o status da tarefa em `PROJECT_STATUS.md` e `TASKS.md`.
- Registre decisões arquiteturais em `DECISIONS.md`.
- Liste em `CHANGELOG_AI.md` os testes executados e o resultado real, incluindo falhas.
- Não considere uma tarefa concluída só porque o código compila: use os critérios de conclusão da tarefa.
- Diga o que ficou sem cobertura de teste e o que depende de serviço externo.
