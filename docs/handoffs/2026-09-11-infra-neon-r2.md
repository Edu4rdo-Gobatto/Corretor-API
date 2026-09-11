# Handoff — 11/09/2026 — Infraestrutura criada e homologada

De: Claude (sessão de análise, sincronização e infraestrutura)
Para: o próximo agente (Codex ou Claude) e o dono do projeto
Escopo: os dois repositórios, `corretor-api` e `corretor-web`

Este documento descreve o estado real verificado, o que foi feito, o que diverge da documentação existente e
o que fazer em seguida. Ele vale mais que o `README.md` e o `PLANO-PROJETO-CORRETOR.md`, que estão desatualizados.

---

## 1. Ponto de partida

| Repositório | `main` local | `main` no GitHub | Situação |
|---|---|---|---|
| corretor-api | `a41f49b` | `a41f49b` | sincronizados |
| corretor-web | `d4f6b2f` | `d4f6b2f` | sincronizados (atualizado nesta sessão, estava em `78200ff`) |

O commit `d4f6b2f` do front ("feat: add complete SEO and SSR delivery") acrescentou SSR das páginas públicas,
metadados com Open Graph, Twitter Cards e JSON-LD, `robots.txt`, `sitemap.xml` e `llms.txt` dinâmicos,
`vercel.json` com Build Output API v3 e as variáveis `API_ORIGIN`, `SITE_URL` e `SEO_INDEXABLE`.

### O commit de segurança da API não existe

Um parecer anterior afirma que a API recebeu uma rodada de "segurança e operações" no commit `accd5d9`, com
Helmet, health check, rate limit de leads, criptografia AES-256-GCM dos dados pessoais de leads, filtro global de
exceções, compatibilidade com `/api/v1` e transações nas operações de mídia, além de 144 testes.

Busca feita em 11/09: `main`, `shura`, todos os commits alcançáveis, commits soltos (`git fsck`), stash, reflog,
tags, forks e pull requests, além da API do GitHub por SHA. **O commit não existe em lugar nenhum acessível.**
Nenhuma dessas funcionalidades está no código: `grep` por helmet, cipher, health, `setGlobalPrefix` e
`ExceptionFilter` não retorna nada em `src/`. A API tem **130 testes**, não 144.

Conclusão: essa rodada só existe na cópia local do autor (SHURIKA6) e precisa de um `git push`. Tarefa SEC-001.

---

## 2. O que foi feito nesta sessão

1. **Front sincronizado** de `78200ff` para `d4f6b2f`.
2. **Verificação local dos dois repositórios:** API com 130 testes aprovados em 13 suítes; front com 64 testes em
   17 arquivos; lint, typecheck e build sem erro nos dois; smoke do SSR em modo demo aprovado.
3. **Neon criado e configurado:** PostgreSQL 16.15, banco `corretor-db`, região `aws-sa-east-1` (São Paulo),
   conexão direta sem pooler. As 5 migrations foram aplicadas e criaram `agents`, `properties`, `property_media`,
   `leads` e `refresh_sessions`.
4. **Cloudflare R2 criado e configurado:** bucket `corretor-midia`, classe Standard, Public Development URL ativa e
   token de API com permissão Object Read & Write restrita ao bucket.
5. **Primeiro ADMIN criado:** id `190d1d1a-f9aa-41f5-8218-ec9dcd5e2c9f`, papel ADMIN, ativo. As variáveis
   `BOOTSTRAP_*` foram removidas do `.env` em seguida.
6. **Backups:** dois arquivos em `backups/` (após as migrations e após a homologação), gerados com `pg_dump` 16 via Docker.
7. **Teste ponta a ponta com serviços reais, pelo proxy do front: 25 passos, todos aprovados.**

### O que o teste ponta a ponta cobriu

| Passo | Resultado |
|---|---|
| Login com `Origin` do front | 200, com cookie `corretor_refresh` |
| Login com origem estranha | 403 "Origem não autorizada." |
| Criar imóvel | 201, slug gerado com o UUID, valores numéricos convertidos |
| Upload de 3 imagens ao R2 | 201, três URLs `r2.dev` respondendo 200 |
| Definir capa na 2ª imagem | 200 |
| Excluir a 3ª imagem | 204; a URL passou a responder 404 (objeto removido do R2) |
| Detalhe público | 2 mídias, capa correta, contato do corretor sem e-mail nem papel |
| Página SSR do imóvel | 200, com título, JSON-LD `RealEstateListing` e `BreadcrumbList`, canonical e `og:image` apontando para o R2 |
| Lead sem consentimento | 400 |
| Lead com consentimento | 201, com IP, data/hora e `terms_version` `v1.0` gravados pelo servidor |
| Listagem no painel | 1 lead |
| Limpeza | mídias, lead e imóvel removidos; catálogo zerado; bucket sem objetos |

---

## 3. Estado atual dos serviços

| Serviço | Estado | Detalhes que importam |
|---|---|---|
| Neon | ativo | Free: 0,5 GB por projeto e 100 CU-horas/mês; suspende a computação após 5 min de inatividade; a região não pode ser trocada |
| Cloudflare R2 | ativo | Free: 10 GB, 1 M operações classe A e 10 M classe B por mês, egress grátis; ativar o R2 exige cartão cadastrado; a URL `r2.dev` é limitada e destinada a desenvolvimento |
| Render | não criado | não tem região na América do Sul |
| Vercel | não criado | verificar a restrição de uso comercial do plano Hobby antes de publicar |

Banco hoje: 1 administrador, nenhum imóvel, mídia ou lead. Bucket: vazio, fora uma imagem de amostra em `_amostra/`.

---

## 4. Armadilhas descobertas na prática

1. **A Cloudflare bloqueia o User-Agent `Python-urllib` com 403** na URL pública do R2. Não é erro de configuração:
   Node, curl e navegador recebem 200. Scripts de teste em Python precisam enviar um User-Agent de navegador.
2. **JSON-LD e canonical só são gerados quando `SITE_URL` está definida** (`src/seo/metadata.ts` do front).
   Em desenvolvimento, use `SITE_URL=http://127.0.0.1:5173`, que é o valor no `.env` local atual.
3. **`ALLOWED_ORIGINS` compara o header `Origin` por igualdade exata.** O servidor do front sobe em `127.0.0.1:5173`,
   então `http://localhost:5173` e `http://127.0.0.1:5173` são origens diferentes. As duas estão no `.env` local.
4. **`migration:*` e `bootstrap:admin` validam o ambiente inteiro**, inclusive `JWT_SECRET` e as `R2_*`, antes de conectar.
5. **Excluir um imóvel não apaga os objetos no R2**: as linhas de `property_media` saem por CASCADE, sem chamada de exclusão.
   Apague a mídia antes do imóvel para não deixar lixo no bucket.
6. **`psql` e `pg_dump` não estão instalados** na máquina do projeto; use a imagem Docker `postgres:16`.
7. **O npm 11 não executa os scripts de instalação** de `argon2` e `esbuild` (allowlist de scripts). Os dois têm binário
   pronto para Linux e funcionam assim; testes e build passam.

---

## 5. Divergências entre o código e a especificação

Comparação item a item com `corretor-spec.json`, com verificação independente: **256 conformes, 11 divergentes,
2 parciais, nenhum ausente, 78 extras e 37 fora do código** (contas, deploy e processo).

Divergências:

1. Não existe `DELETE` de corretor; a remoção é desativação por `PATCH /agents/:id { active: false }`.
2. O schema vem de migration explícita, não de `synchronize`.
3. O botão do modal diz "Falar pelo WhatsApp", e o da página de detalhe, "Tenho interesse". A spec dizia "Falar com o corretor".
4. O texto do `wa.me` usa acentos e passa por `encodeURIComponent`; a spec mostra o texto sem acento e sem codificação.
5. `terms_version` é `v1.0` na API; só o modo demo do front usa `1.0`.
6. Os arquivos `services/auth.service.ts`, `properties.service.ts` e `leads.service.ts` não existem: as funções ficam
   em `api.ts`, `http.ts`, `catalog.ts` e `lead.ts`.
7. `hooks/useAuth.tsx`, não `useAuth.ts`.
8. `VITE_API_URL=/api` com proxy, em vez de `http://localhost:3000`.
9. `JWT_EXPIRES_IN` de `15m`, mais refresh de 30 dias, em vez de `7d`.

Parciais: nada no código trata cold start, e nada controla o uso total frente aos limites dos planos gratuitos.

Extras relevantes, que a spec não pedia e o código tem: refresh/logout com tabela `refresh_sessions`, guarda de origem,
rate limit de login, proteção do último ADMIN com advisory lock, rotas `/admin/properties`, filtros e busca de leads,
modo demonstração no front, rascunho de formulário, error boundary e 194 testes automatizados somando os dois repositórios.

---

## 6. Próximos passos sugeridos

1. **SEC-001** — recuperar o `accd5d9` com o autor. Se ele acrescentar migrations, aplicar com backup antes;
   se **alterar** migration já aplicada, parar e decidir com o dono do projeto, porque o banco real já existe.
2. **DEPLOY-001 / DEPLOY-002** — publicar API e front. Pontos abertos que precisam de decisão registrada:
   - cold start do plano gratuito do Render somado à suspensão do Neon após 5 min, contra o timeout de 10 s
     que o SSR usa ao buscar dados públicos da API;
   - restrição de uso comercial do plano Hobby da Vercel;
   - latência entre a API nos EUA e o banco em São Paulo;
   - a API não tem rota de health.
3. **ADMIN-001** — corrigir o WhatsApp do administrador, hoje com o número de exemplo.
4. **DOC-001** — atualizar os READMEs dos dois repositórios, desatualizados em pontos conhecidos.
5. **OPS-001** — definir a limpeza periódica de `refresh_sessions`.

---

## 7. Como retomar o trabalho localmente

```bash
# API
cd /home/usuario/eduardo/Corretor-API
npm ci
npm test                    # 130 testes, não precisa de .env
npm run migration:show      # precisa do .env com o Neon
npm run start:dev           # porta 3000

# Front, em outro terminal
cd /home/usuario/eduardo/Corretor-web
npm ci
npm run dev                 # SSR em 127.0.0.1:5173, com proxy /api para a API
npm run dev:demo            # dados fictícios em memória, sem API e sem banco
```

O `.env` de cada repositório já está preenchido na máquina do dono do projeto e não é versionado.
Para rodar em outra máquina, use `.env.example` como base e obtenha as credenciais com o dono.
