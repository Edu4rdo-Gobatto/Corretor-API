# Foto do perfil — contrato aditivo de 06/10/2026

Plano aprovado pelo dono. Código no commit `86ecf29`. Mantém JSON, Corretor e url_foto; não há migration.

## PATCH /api/v1/autenticacao/eu

- JSON: campos opcionais nome, whatsapp, creci, url_foto. Omitir url_foto não editada; null remove.
- Multipart: um campo foto e nome/whatsapp/creci; creci vazio equivale a null. Nunca combinar arquivo e
  url_foto explícita (400), inclusive null. Só JPG/PNG/WebP, assinatura compatível, <=10 MiB após compressão.
- Guards JWT/origem antes da recepção; quota de 2 envios simultâneos por instância compartilhada com
  imóveis; fields=4, fieldSize=2048, files=1, parts=6, headerPairs=100. Campo extra/arquivo adicional rejeitado.
- PutObject usa chave corretores/{id}/{UUID}.{extensão} no bucket privado existente. Upload antes da
  transação curta; falha de DB tenta DeleteObject do novo. Foto anterior do proprietário só é limpa após
  commit. URL externa ou objeto de terceiro não é apagado. Exclusão falha registra órfão, preservando sucesso.
- Referência gerenciada diferente da atual, sem arquivo recém-enviado nesta requisição, recebe 409.
  Evita que abas antigas restaurem objetos já apagados. Resposta mantém o objeto Corretor atual.

## GET /api/v1/corretores/:id/foto

Consulta corretor ativo pelo id; sem foto/inativo/objeto ausente retorna 404. Lê somente sua chave
gerenciada; JPEG/PNG/WebP, Content-Disposition inline, nosniff e Cache-Control no-cache. Falha R2 retorna
503. URL externa deve ser HTTPS e recebe redirect 302. Query de URL/chave não altera o objeto escolhido.
Cross-Origin-Resource-Policy permite exibição pela base externa da API; proxy existente também funciona.

Frontend centraliza exibição por `urlFotoCorretor`, com hash da referência como revisão. Perfil, sidebar,
ficha e detalhe público usam a mesma rota. Arquivo/URL/prévia ainda não persistidos fazem parte da guarda.
Salvar dados não redefine a senha digitada. Novos envios ficam bloqueados durante a operação.

## Evidências e limites

Typecheck, lint e build aprovados nos dois projetos. Frontend: 21 testes existentes e smoke SSR.
API sem fontes de teste (o `npm test` da API sai com "No tests found", código 1). QA efêmero 22 cenários HTTP + concorrência
com controllers/services reais e auth/R2/banco simulados. Navegador Chrome: 23 cenários/32 capturas.
R2 real: objeto temporário isolado sob corretores/0 enviado, lido e excluído; GET posterior 404.
Nenhum perfil gravado no Neon. Homologação com login, banco real, proxy e sessão juntos permanece pendente;
Safari/iOS/celular físico não verificados. Sem migrations. Publicado no Render de teste em 08/10 (registro no Corretor-web).

System Design no front: [2026-10-06-system-design.docx](../../Corretor-web/docs/2026-10-06-system-design.docx).
