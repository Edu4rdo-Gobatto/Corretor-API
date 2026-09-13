# Primeira entrega de administração de locações

## Escopo aprovado
Somente ADMIN. Proprietários e inquilinos PF/PJ, dados bancários do proprietário, documentos privados e contratos com um imóvel/locador/locatário. Cadastro manual. Sem comissão, cobrança, repasse, importação ou integração SI9/Imonov nesta entrega.

## Contrato de implementação
- API /admin/rental-parties: GET paginado (page, limit, search, kind OWNER/TENANT, active true/false), POST; GET/PATCH /:id. Campos kind, personType PF/PJ, name, taxId (CPF/CNPJ sem pontuação), email, phone, address, birthDate, notes; bankName, bankAgency, bankAccount, pixKey para OWNER. Campos opcionais usam string vazia. active boolean. PATCH envia ficha completa; kind imutável.
- /admin/leases: GET paginado (page, limit, search, partyId, status), POST; GET/PATCH /:id. reference, propertyId, ownerId, tenantId, startDate/endDate YYYY-MM-DD, rentAmount string decimal positiva, dueDay 1–31, status DRAFT/ACTIVE/ENDED, notes. Resposta inclui propertyTitle, ownerName, tenantName. Uma locação ACTIVE por imóvel; não excluir históricos. Valores não geram cobranças ainda.
- /admin/rental-documents?partyId=UUID ou leaseId=UUID: GET lista, POST multipart (file e vínculo único). DELETE /:id, GET /:id/download binário autenticado. Resposta id, fileName, contentType, size, createdAt, partyId, leaseId. PDF/JPEG/PNG até 10 MiB, assinatura validada. Bucket R2 privado separado, variável opcional R2_DOCUMENTS_BUCKET; sem configuração, operação retorna 503 sem fallback público.
- Páginas /admin/proprietarios, /admin/inquilinos e /admin/contratos, busca/paginação, inclusão/edição, ficha com vínculos e anexos. Guard ADMIN antes das buscas. Estilos existentes, react-hook-form/zod, mensagens acessíveis, rede sem dados fictícios.
- Dados pessoais complementares e bancários cifrados; nomes pesquisáveis. Downloads sem cache, attachment, sem URL pública. Exclusão de imóvel com contrato bloqueada por FK RESTRICT.

## Execução e verificação
- [ ] Testes de contratos HTTP/validação/permissões e regras de domínio antes da implementação.
- [ ] API: módulo rentals (entidades, DTOs, serviços, controllers); nova migration aditiva, registrada no data-source. Não editar migrations anteriores nem aplicar automaticamente no Neon.
- [ ] Front: tipos, cliente API e download usando refresh compartilhado, páginas/formulários/anexos e rotas ADMIN.
- [ ] Testes, typecheck, lint e build em ambos; smoke SSR; revisar autorização, integridade dos vínculos e privacidade de anexos.
- [ ] Atualizar contexto, decisões, changelog, README, especificação e plano compartilhados sem apagar histórico; registrar dependências de infraestrutura e resultados reais.

## Decisões operacionais
Trabalho direto na main conforme AGENTS.md, sem commit/push. Preservar alterações preexistentes da API. Documentação descreve implementação separada de homologação: banco real somente com backup e infraestrutura privada configurada. Datas civis sem conversão de fuso, vencimentos 29–31 serão tratados na futura etapa de cobranças. Sem política de comissão presumida.
