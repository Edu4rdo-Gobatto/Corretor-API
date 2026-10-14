# Tarefa R2-URL-001 — URL pública própria do bucket R2

- **Status:** aberta, depende do dono
- **Responsável:** dono (painel da Cloudflare e DNS)
- **Prioridade:** alta. Toda foto enviada pelo painel recebe a URL `R2_PUBLIC_URL/<chave>`
  (`src/midias/midias.service.ts`, `src/corretores/fotos-corretor.service.ts`). Em 03/10 a URL configurada
  (`*.r2.dev`) respondeu **HTTP 401**, então imagens novas do catálogo podem não abrir para os visitantes. O catálogo
  de demonstração só funciona porque usa URLs do Unsplash.

## O que o dono precisa fazer

1. No painel da Cloudflare → R2 → bucket `corretor-midia` → **Settings → Public access**, escolher uma das opções:
   - **Domínio próprio (recomendado):** conectar um subdomínio, como `midia.seudominio.com.br`. Exige que o domínio
     esteja na Cloudflare. Tem cache da CDN e não tem limite de requisições.
   - **`r2.dev`:** habilitar o acesso público do subdomínio de desenvolvimento. A Cloudflare limita requisições e não
     recomenda para produção.
2. Abrir no navegador uma imagem já enviada (`<URL pública>/imoveis/<id>/<arquivo>`) e confirmar **HTTP 200**.
3. No Render, atualizar `R2_PUBLIC_URL` com essa URL (`https://`, sem barra no final). No `.env` local, o mesmo valor.

## Validação (critério de conclusão)

- Enviar uma foto nova num imóvel pelo painel e ver a capa no catálogo público e no detalhe, numa janela anônima.
- `curl -I <url da mídia>` responde 200 com `Content-Type` de imagem.
- Mídias antigas: as linhas em `imoveis_midias.url` guardam a URL completa. Se a base mudar, as URLs antigas
  continuam com a base anterior; avaliar com o agente uma migração de dados (exige backup e autorização) só se
  houver mídias reais enviadas antes da troca.
- Registrar a decisão no `DECISIONS.md` (a regra "não mudar a política de acesso do bucket sem decisão registrada"
  vale aqui) e o resultado no `CHANGELOG_AI.md`.

## Não fazer

- Não tornar público o bucket inteiro sem registrar a decisão.
- Não expor `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`: a URL pública é só de leitura.
