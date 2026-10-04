# 🚀 SUPER PROMPT: REFATORAÇÃO E DESENVOLVIMENTO INTEGRAL DO BACKEND (CORRETOR-API)

## 📌 1. CONTEXTO E STACK TECNOLÓGICA
Você é o Arquiteto de Software e Engenheiro Backend sênior responsável pelo desenvolvimento e refatoração completa da *Corretor-API*, uma API REST para gestão imobiliária comercial.
O repositório irmão de frontend é o *Corretor-web* (React 18 + Vite 7 + SSR próprio).

### Stack Tecnológica Obrigatória:
- *Framework:* NestJS 11 sobre Express.
- *Linguagem:* TypeScript em modo estrito (strict: true, sem uso de any ou @ts-ignore).
- *ORM & Banco de Dados:* TypeORM 0.3 com PostgreSQL 16 hospedado no Neon (conexão direta SSL sslmode=require). Schema gerenciado *exclusivamente via Migrations* (synchronize: false).
- *Validação & Transformação:* class-validator e class-transformer com ValidationPipe global configurado com whitelist: true, forbidNonWhitelisted: true e transform: true.
- *Armazenamento de Mídia:* Cloudflare R2 via @aws-sdk/client-s3 (bucket público corretor-midia).
- *Segurança & Senhas:* Hash Argon2id para senhas e tokens de sessão persistidos em SHA-256 via Cookies HttpOnly, SameSite: Strict e Secure.
- *Integração Externa:* Google Drive API para criação e gestão automatizada de pastas de contratos.

---

## 🏛️ 2. DIRETRIZES ARQUITETURAIS GLOBAIS

1. *Nomenclatura 100% em Português:*
   - Todas as tabelas do banco, colunas, enums, DTOs, entidades, rotas e controllers devem utilizar português brasileiro de forma consistente e padronizada.
2. *Política de Exclusão (Soft Delete):*
   - Entidades de negócio (corretores, imoveis, clientes, contrato, etc.) utilizam *exclusão lógica* (ativo: boolean DEFAULT true), permitindo desativação e reativação.
   - *Exceção de Exclusão Física:* Apenas imoveis_midias sofre exclusão física (remove o arquivo do Cloudflare R2 e o registro no banco para economizar armazenamento).
3. *Auditoria Padrão em Todas as Tabelas:*
   - criado_em (timestamptz DEFAULT now())
   - alterado_em (timestamptz DEFAULT now())
   - criado_por (uuid NULL REFERENCES corretores(id))
   - alterado_por (uuid NULL REFERENCES corretores(id))
4. *LGPD e Criptografia:*
   - A proteção de dados pessoais é assegurada por canal TLS/SSL (sslmode=require), criptografia de disco em repouso (AES-256 no Neon/AWS) e controle de autenticação/autorização JWT.
   - *NÃO UTILIZAR criptografia de coluna (Field/Column-Level Encryption)* em campos de texto comuns (nome, email, telefone), pois isso invalida índices B-Tree e buscas textuais (ILIKE).
5. *Tabelas Eliminadas do Projeto Antigo:*
   - ❌ rental_documents: Eliminada. Gestão de documentos de locação é delegada ao Google Drive via API.
   - ❌ rent_payments: Eliminada. A imobiliária não faz intermediação de repasse mensal de aluguéis por dentro do software. O financeiro da imobiliária fica concentrado em comissoes.

---

## 🗄️ 3. ESQUEMA DETALHADO DO BANCO DE DADOS (TABELAS E REGRAS)

### 1. corretores (Usuários e Administradores)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - nome: text NOT NULL (2 a 100 chars)
  - email: text NOT NULL UNIQUE (normalizado em minúsculo: CHECK (email = lower(btrim(email))))
  - senha_hash: text NOT NULL (select: false, Argon2id)
  - cpf: text NOT NULL
  - whatsapp: text NOT NULL (formato flexibilizado: aceita DDD + número com 10 ou 11 dígitos, ex: 66999999999, com ou sem DDI)
  - creci: text NULL
  - cargo: enum ('ADMIN', 'CORRETOR') NOT NULL DEFAULT 'CORRETOR'
  - url_foto: text NULL
  - ativo: boolean NOT NULL DEFAULT true
  - criado_em, alterado_em: timestamptz NOT NULL
  - criado_por, alterado_por: uuid NULL
- *Regras & Travas:*
  - Travamento via PostgreSQL Advisory Lock (pg_advisory_xact_lock) no PATCH para impedir a desativação ou rebaixamento do último ADMIN ativo do sistema.
  - Listagem com paginação e busca textual apenas por nome.

### 2. tipos_imovel (Desacoplamento de Tipos de Imóvel)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - nome: text NOT NULL UNIQUE (ex: "Galpão", "Sala Comercial", "Prédio", "Loja", "Terreno")
  - slug: text NOT NULL UNIQUE
  - ativo: boolean NOT NULL DEFAULT true
  - criado_em, alterado_em: timestamptz NOT NULL
- *Funcionalidade:* CRUD simples e completo para o corretor/admin cadastrar novos tipos livremente.

### 3. finalidades_imovel (Desacoplamento de Finalidades)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - nome: text NOT NULL UNIQUE (ex: "Locação", "Venda", "Locação e Venda")
  - slug: text NOT NULL UNIQUE
  - ativo: boolean NOT NULL DEFAULT true
  - criado_em, alterado_em: timestamptz NOT NULL
- *Funcionalidade:* CRUD simples para cadastro dinâmico de finalidades.

### 4. caracteristicas e imoveis_caracteristicas (Tags Relacionais sem JSON)
- *caracteristicas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - nome: text NOT NULL UNIQUE (ex: "Portaria 24h", "Ar Condicionado", "Pé Direito Alto", "Vagas de Garagem")
  - icone: text NULL
  - ativo: boolean NOT NULL DEFAULT true
- *imoveis_caracteristicas:*
  - imovel_id: uuid REFERENCES imoveis(id) ON DELETE CASCADE
  - caracteristica_id: uuid REFERENCES caracteristicas(id) ON DELETE RESTRICT
  - valor: text NULL (ex: "4 vagas", "10 metros")
  - PRIMARY KEY (imovel_id, caracteristica_id)

### 5. imoveis (Catálogo e Gestão de Imóveis)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - titulo: text NOT NULL (3 a 200 chars)
  - slug: text NOT NULL UNIQUE (gerado como titulo-slug-<uuid>)
  - tipo_id: uuid NOT NULL REFERENCES tipos_imovel(id)
  - finalidade_id: uuid NOT NULL REFERENCES finalidades_imovel(id)
  - valor: numeric(12,2) NOT NULL CHECK (valor >= 0)
  - valor_condominio: numeric(10,2) NULL CHECK (valor_condominio >= 0)
  - valor_iptu: numeric(10,2) NULL CHECK (valor_iptu >= 0)
  - area_util: numeric(10,2) NOT NULL CHECK (area_util > 0)
  - area_total: numeric(10,2) NOT NULL CHECK (area_total >= area_util)
  - cep: text NULL
  - logradouro: text NOT NULL
  - numero: text NOT NULL
  - complemento: text NULL
  - bairro: text NOT NULL
  - cidade: text NOT NULL
  - estado: text NOT NULL (UF 2 letras)
  - descricao: text NOT NULL (até 20.000 chars)
  - status: enum ('DISPONIVEL', 'RESERVADO', 'CONCLUIDO') NOT NULL DEFAULT 'DISPONIVEL'
  - corretor_id: uuid NOT NULL REFERENCES corretores(id)
  - ativo: boolean NOT NULL DEFAULT true
  - criado_em, alterado_em: timestamptz NOT NULL
  - criado_por, alterado_por: uuid NULL
- *Regra de Visibilidade e Negócio:*
  - *Catálogo Público (GET /imoveis):* Exibe apenas status = 'DISPONIVEL', ativo = true e corretor responsável ativo = true.
  - *Gestão Interna (GET /admin/imoveis):* *Todos os corretores autenticados têm acesso a visualizar todos os imóveis da imobiliária*, independentemente de quem cadastrou. Edição restrita ao corretor do imóvel ou ADMIN.
- *Filtros Suportados:* tipo_id, finalidade_id, cidade, valor_min, valor_max, busca textual por título e paginação.

### 6. imoveis_midias (Fotos e Vídeos dos Imóveis)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - imovel_id: uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE
  - tipo: enum ('IMAGEM', 'VIDEO_EMBED', 'VIDEO_ARQUIVO') NOT NULL
  - url: text NOT NULL
  - chave_armazenamento: text NULL (caminho no bucket Cloudflare R2)
  - ordem: integer NOT NULL DEFAULT 0
  - capa: boolean NOT NULL DEFAULT false
  - criado_em: timestamptz NOT NULL DEFAULT now()
  - criado_por: uuid NOT NULL REFERENCES corretores(id)
- *Regras:*
  - Upload multipart em memória para Cloudflare R2 (corretor-midia).
  - Suporte a links de vídeo do YouTube e Vimeo (VIDEO_EMBED).
  - Reordenação em lote via transação.
  - Exclusão física: remove do R2 e deleta do banco. Se a mídia excluída for a capa, define automaticamente a primeira foto restante como nova capa.

### 7. clientes (Leads e Cadastros Diretos)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - imovel_id: uuid NULL REFERENCES imoveis(id) ON DELETE SET NULL (imóvel de interesse)
  - corretor_id: uuid NOT NULL REFERENCES corretores(id) (corretor responsável pelo atendimento)
  - nome: text NOT NULL
  - telefone: text NOT NULL
  - email: text NULL
  - mensagem: text NULL
  - origem: enum ('SITE', 'MANUAL') NOT NULL DEFAULT 'SITE'
  - consentimento: boolean NOT NULL DEFAULT false
  - consentimento_ip: text NULL
  - consentimento_em: timestamptz NULL
  - versao_termos: text NULL DEFAULT 'v1.0'
  - ativo: boolean NOT NULL DEFAULT true
  - criado_em, alterado_em: timestamptz NOT NULL
  - criado_por, alterado_por: uuid NULL
- *Regras:*
  - *Cadastro Público (POST /clientes):* Formulário web com rate limit e consentimento LGPD obrigatório.
  - *Cadastro Manual (POST /admin/clientes):* Corretor cadastra cliente direto no painel sem exigir imóvel vinculado nem consentimento web.
  - *Privacidade de Atendimento:* Corretores comuns visualizam apenas seus próprios clientes atribuídos; ADMIN visualiza todos.
  - *Filtros:* Busca por nome e filtro por imovel_id.

### 8. sessoes_login (Sessões e Refresh Tokens Rotativos)
- *Colunas:*
  - token_hash: text PRIMARY KEY (hash SHA-256 do token gerado)
  - corretor_id: uuid NOT NULL REFERENCES corretores(id) ON DELETE CASCADE
  - expira_em: timestamptz NOT NULL (30 dias)
  - criado_em: timestamptz NOT NULL DEFAULT now()
- *Regras:*
  - Cookie HttpOnly, SameSite: Strict, Secure.
  - Rotação estrita com DELETE RETURNING para consumo atômico.
  - Job periódico em background executando limpeza a cada hora (DELETE WHERE expira_em <= now()).

### 9. ⚠️ partes_locacao (Locadores e Inquilinos — ALTA PRIORIDADE DE REPLANEJAMENTO)
- *Atenção:* O modelo legado possuía uma coluna private_data com JSON criptografado que deve ser *completamente eliminada*.
- *Nova Estrutura com Colunas Reais e Indexadas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - papel: enum ('LOCADOR', 'LOCATARIO') NOT NULL
  - tipo_pessoa: enum ('PF', 'PJ') NOT NULL
  - nome: text NOT NULL
  - cpf_cnpj: text NOT NULL (com validação de formato e busca indexada)
  - email: text NULL
  - telefone: text NULL
  - endereco: text NULL
  - data_nascimento: date NULL
  - banco_nome: text NULL
  - banco_agencia: text NULL
  - banco_conta: text NULL
  - chave_pix: text NULL
  - observacoes: text NULL
  - ativo: boolean NOT NULL DEFAULT true
  - criado_em, alterado_em: timestamptz NOT NULL
  - criado_por, alterado_por: uuid NULL
- *Regras:* Soft delete com bloqueio de desativação caso haja contrato de locação ativo vinculado.

### 10. contrato (Contratos de Locação Comercial)
- *Colunas:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - numero_contrato: text NOT NULL UNIQUE (ex: "LOC-2026-001")
  - imovel_id: uuid NOT NULL REFERENCES imoveis(id) ON DELETE RESTRICT
  - locador_id: uuid NOT NULL REFERENCES partes_locacao(id) ON DELETE RESTRICT
  - locatario_id: uuid NOT NULL REFERENCES partes_locacao(id) ON DELETE RESTRICT
  - corretor_id: uuid NOT NULL REFERENCES corretores(id) (corretor intermediador)
  - data_inicio: date NOT NULL
  - data_fim: date NOT NULL CHECK (data_fim >= data_inicio)
  - valor_aluguel: numeric(12,2) NOT NULL CHECK (valor_aluguel > 0)
  - dia_vencimento: integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31)
  - taxa_administracao: numeric(5,2) NOT NULL (porcentagem de comissão da imobiliária, ex: 8.00 ou 10.00)
  - garantia_locaticia: text NOT NULL (Caução, Fiador, Seguro Fiança, Título de Capitalização, etc.)
  - indice_reajuste: text NOT NULL (IGP-M, IPCA, etc.)
  - cobranca_iptu_condominio: text NOT NULL (No boleto pela imobiliária ou pago diretamente pelo inquilino)
  - url_pasta_drive: text NULL (link da pasta gerada automaticamente no Google Drive)
  - status: enum ('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO'
  - observacoes: text NULL
  - criado_em, alterado_em: timestamptz NOT NULL
  - criado_por, alterado_por: uuid NULL
- *Regras de Negócio Fundamentais:*
  - *Trava de Unicidade:* Índice único parcial (UNIQUE INDEX ON contrato (imovel_id) WHERE status = 'ATIVO'), garantindo que nenhum imóvel tenha mais de 1 contrato ativo simultâneo.
  - *Sem restrição de finalidade:* Qualquer imóvel pode receber contrato de locação.
  - *Automação de Encerramento:* Quando a data atual ultrapassa data_fim, o contrato muda seu status para 'INATIVO' automaticamente.
  - *Google Drive API:* Ao salvar um contrato ativo, invocar a API do Google Drive para criar a pasta oficial (Imobiliária / Contratos / {numero_contrato} - {locatario}) e persistir o link retornado em url_pasta_drive.
  - *Permissão:* Acesso concedido tanto aos ADMIN quanto ao corretor_id intermediador.

### 11. comissoes e parcelas_comissao (Receita de Intermediação da Imobiliária)
- *Finalidade:* Controlar exclusivamente a receita e honorários devidos à imobiliária pelo fechamento do negócio (o repasse de comissão entre imobiliária e corretor é extra-sistema).
- *comissoes:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - tipo_operacao: enum ('LOCACAO', 'VENDA') NOT NULL
  - contrato_id: uuid NULL REFERENCES contrato(id) (se locação)
  - imovel_id: uuid NOT NULL REFERENCES imoveis(id)
  - cliente_id: uuid NOT NULL REFERENCES clientes(id)
  - valor_total: numeric(12,2) NOT NULL CHECK (valor_total > 0)
  - quantidade_parcelas: integer NOT NULL CHECK (quantidade_parcelas >= 1)
  - observacoes: text NULL
  - criado_em, alterado_em: timestamptz NOT NULL
  - criado_por, alterado_por: uuid NULL
- *parcelas_comissao:*
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - comissao_id: uuid NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE
  - numero_parcela: integer NOT NULL (1, 2, 3...)
  - data_vencimento: date NOT NULL
  - valor: numeric(12,2) NOT NULL
  - status: enum ('PENDENTE', 'PAGO', 'ATRASADO') NOT NULL DEFAULT 'PENDENTE'
  - pago_em: timestamptz NULL
  - observacao_pagamento: text NULL
- *Regras & Automações:*
  - Geração automática das parcelas divididas mensalmente a partir da data do primeiro vencimento.
  - Se a data atual for maior que data_vencimento e status != 'PAGO', a parcela assume automaticamente o status 'ATRASADO'.
  - Baixa manual realizada pelo usuário com confirmação de pagamento e comprovante em observacao_pagamento.

---

## 🚦 4. PLANO DE AÇÃO PARA IMPLEMENTAÇÃO PASSO A PASSO

Ao iniciar o desenvolvimento, siga estritamente as etapas abaixo:

1. *Fase 1: Preparação e Migrations:*
   - Criar novas Migrations TypeORM com as tabelas em português e as regras de integridade (CHECK, UNIQUE, índices parciais).
   - Aplicar estratégia de migração ou recriação limpa das tabelas (considerando que o banco Neon está em fase de desenvolvimento).
2. *Fase 2: Entidades e Repositórios TypeORM:*
   - Definir as entidades TypeORM com tipagem estrita, relações (ManyToOne, OneToMany) e exclusão lógica.
3. *Fase 3: DTOs e Pipes de Validação:*
   - Criar DTOs com class-validator e class-transformer para todas as requisições, com validação de CPF/CNPJ, telefones nacionais flexibilizados e remoção de dados sensíveis nas respostas.
4. *Fase 4: Serviços e Regras de Negócio:*
   - Implementar os Services contendo as travas de segurança (Advisory Lock para ADMIN, unicidade de contrato ativo, inativação automática por data).
   - Implementar a integração com Google Drive API via Service Account.
5. *Fase 5: Controllers e Rotas RESTful:*
   - Padronizar rotas públicas (/imoveis, /clientes) e administrativas (/admin/*) com Guards de JWT e Roles.
6. *Fase 6: Testes Automatizados e Homologação:*
   - Atualizar e executar a suíte de testes com Jest (npm test), validação de tipos (npm run typecheck) e lint (npm run lint), garantindo 100% de aprovação.

---

Execute o desenvolvimento com foco em excelência, robustez, código limpo e arquitetura à prova de falhas!