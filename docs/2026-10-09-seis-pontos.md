# Correção dos seis pontos — 09/10/2026

Pedido do dono com plano autorizado: corrigir frontend e API preservando os dados existentes. Entrega na `main`
dos dois repositórios, sem migrations, dependências novas ou suítes novas. Na API, commit `6b987a5`, ainda sem deploy. Na publicação, a API
sai antes do frontend (o catálogo com vários tipos e o seletor de clientes da comissão dependem dos novos contratos).

## 1. Setinhas dos campos numéricos

`global.css` oculta os controles nativos de incremento em todo `input[type=number]`: `appearance: textfield` (Firefox)
e `::-webkit-inner/outer-spin-button` sem aparência (Chromium/Safari). Tipo, `min`/`max`/`step`, teclado (setas) e foco
visível ficam como estavam. Hoje os campos `number` estão nos filtros de preço/área do catálogo; `CampoNumero` já é texto.

## 2. CRECI

Regra única: números seguidos de, no máximo, um `J` ou `F`, só no final. Aceitos `15776`, `15776F`, `15776J`, zeros à
esquerda e até 50 caracteres; minúsculas viram maiúsculas. Campo opcional.

- **API** — `CriarCorretorDto.creci` (DTO-base de criação, `AtualizarCorretorDto` e `AtualizarPerfilDto`, JSON e
  multipart): trim + maiúsculas; vazio vira `null`; ausente no PATCH mantém o valor; inválido responde 400.
  Leituras e registros antigos fora da regra (ex.: `Teste`) continuam sendo lidos e só mudam quando um novo valor é enviado.
- **Web** — `servicos/creci.ts` (regra, esquema zod, valor de envio) e `componentes/CampoCreci.tsx`, usados no Perfil e no
  editor de corretores. Inserções e colagens que deixariam o valor inválido são recusadas inteiras (`12x34` não vira
  `1234`); apagar é sempre permitido, inclusive no legado. O legado não editado passa na validação e não é reenviado.
  `dadosBase` (redefinir senha, ativar/desativar) deixou de reenviar o CRECI, para não esbarrar em valores antigos.

## 3. Tema claro azul-acinzentado

Tokens do tema claro em `tailwind.css`; fontes, layout, azul e dourado mantidos; tema escuro com os mesmos valores.

| Elementos | Token | Cor |
|---|---|---|
| Fundo / superfícies | `background` / `paper` | `#DCE5F0` / `#EAF0F7` |
| Campos / áreas suaves | `campo` / `soft` | `#E2EAF4` / `#CFDCEB` |
| Texto secundário / borda de controle | `muted` / `control-line` | `#4B5A70` / `#63758E` |
| Divisórias | `line` | `#B6C5D8` |
| Linhas alternadas | `linha-a` / `linha-b` | `#E4EBF4` / `#D8E2EF` |
| Linha destacada / cabeçalho de tabela | `linha-foco` / `cabecalho-tabela` | `#C7D7EA` / `#CCD8E7` |

As variáveis antigas (`--paper`, `--ink`, `--green`, `--soft`, `--muted`, `--line`, `--error`, `--gold`…) do `:root` em
`global.css` agora apontam para os tokens. Contraste calculado (WCAG): textos ≥ 4,73:1 no pior fundo (linha destacada);
borda de controle ≥ 3,21:1 em todos os fundos.

## 4. Filtro de vários tipos de imóvel

Causa do erro: o frontend já enviava `tipo_id=1,4`, mas a API validava um único inteiro e respondia 400 antes do SQL.
Agora `tipo_id` (catálogo público e `/admin/imoveis`) aceita um id ou CSV de até 20 inteiros positivos (até 2147483647);
duplicados são removidos e a consulta usa `IN (:...tipos)` parametrizado. Itens inválidos, vazio, parâmetro repetido
(`tipo_id=1&tipo_id=2`) ou mais de 20 itens → 400. Paginação, ordenação e demais filtros combinam como antes. URLs
públicas, navegação e SSR não mudaram. `tipo_id` de criação/edição continua único.

## 5. Erro de `content.js`

Origem confirmada: `chrome-extension://npclhjbddhklpbnacpjloidibaggcgon/content.js`, script de uma extensão do Chrome,
não do aplicativo. A política do navegador bloqueou `chrome://extensions` na investigação, então o nome da extensão não
foi identificado. O QA desta entrega rodou em Chrome sem extensões, sem erros de JavaScript. Para revisar: abrir
`chrome://extensions`, ativar o modo do desenvolvedor, localizar o ID acima e desativar/remover a extensão ou testar em
janela anônima sem extensões.

## 6. Cliente compatível na comissão

O 400 "Pessoa está vinculada a outro imóvel." vinha do POST porque o seletor listava qualquer pessoa ativa.

- **API** — `GET /admin/comissoes/pessoas-elegiveis` (autenticado, declarado antes de `:id`). Query: `imovel_id`
  obrigatório; `busca` até 200; `pagina=1`; `limite=10` (máx. 100); `pessoa_id` opcional para revalidar. Resposta
  paginada no formato existente com itens `{id, nome}`. Filtra antes da paginação: pessoa ativa, mesmo corretor do
  imóvel, vínculo vazio ou igual ao imóvel. CORRETOR só consulta os próprios imóveis (outro → 404); imóvel inativo →
  lista vazia. Busca por nome, e-mail, telefone ou documento, como a listagem de pessoas. O POST mantém todas as checagens.
- **Web** — `EditorComissao`: cliente desabilitado até o imóvel ser resolvido (venda) ou o contrato carregar o imóvel
  (locação); trocar operação, contrato ou imóvel limpa seleção e sugestões (seletor remontado por imóvel); respostas
  antigas são descartadas. Antes do POST, o cliente é revalidado; se ficou incompatível, o erro aparece no campo e
  receita, parcelas e vencimento ficam preservados. Um 400 da API sobre a pessoa também vai para o campo.

## Validação (resultado real)

- API: `typecheck`, `lint` e `build` aprovados. `npm test` termina com "No tests found" (exit 1): as suítes foram
  removidas em `ab59472` e não foram recriadas.
- Web: `typecheck`, `lint`, `npm test` (3 arquivos, 23 testes) e `build` aprovados.
- QA efêmero da API (78/78): módulos compilados reais, `ValidationPipe` igual ao `main.ts`, login JWT real e PostgreSQL 16
  em contêiner Docker descartável (schema por `synchronize` só no QA). Cobriu CRECI nos três DTOs (JSON e multipart),
  `tipo_id` com nenhum/um/vários/inválidos em público e admin com paginação/ordenação, e pessoas elegíveis com
  permissões, paginação, busca, revalidação, rota `:id` preservada e 401.
- QA efêmero de navegador (63/63): Chrome via Playwright, preview SSR do build apontando para a API de QA. Catálogo
  (abrir/recarregar URLs com 0/1/vários tipos, navegação, limpar), campos numéricos, CRECI (digitar, colar, substituir,
  apagar legado, salvar omitindo/enviando/limpando), comissões (compatíveis, busca, troca de imóvel/contrato/operação,
  incompatível após a escolha sem POST, compatível chegando ao POST interceptado), tema claro/escuro desktop e mobile
  sem rolagem horizontal e sem erros de JavaScript. Nenhuma comissão foi gravada; o POST compatível foi interceptado.
- Não houve acesso ao Neon, ao R2 nem dados reais. Sem cobertura: troca de contrato durante a resposta atrasada (o
  fieldset fica desabilitado enquanto o contrato carrega, então o QA trocou após a resolução), Safari/Firefox reais e
  dispositivo físico.
