# corretor-api

API REST do sistema de gestão imobiliária para corretores. Desenvolvida em NestJS com TypeScript, responsável por autenticação, gerenciamento de imóveis, corretores e captura de leads.

## Stack

- **Runtime:** Node.js
- **Framework:** NestJS + TypeScript
- **Banco de dados:** PostgreSQL via [Neon](https://neon.tech)
- **ORM:** TypeORM
- **Autenticação:** JWT
- **Deploy:** Render

## Pré-requisitos

- Node.js 20+
- npm 10+
- Git

## Instalação e execução local

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/corretor-api.git
cd corretor-api

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Inicie em modo desenvolvimento
npm run start:dev
```

A API estará disponível em `http://localhost:3000`.

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
# Banco de dados
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/corretor-db?sslmode=require

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d

# Aplicação
PORT=3000
NODE_ENV=development
```

> Nunca suba o `.env` para o repositório. Ele já está no `.gitignore`.

## Scripts disponíveis

```bash
npm run start:dev     # Desenvolvimento com hot reload
npm run start:prod    # Produção
npm run build         # Compila o projeto
npm run lint          # Verifica o código
npm run test          # Roda os testes unitários
npm run test:e2e      # Roda os testes end-to-end
```

## Estrutura do projeto

```
src/
├── auth/             # Módulo de autenticação (JWT, guards)
├── imoveis/          # Módulo de gestão de imóveis
├── corretores/       # Módulo de gestão de corretores
├── leads/            # Módulo de captura de leads
├── common/           # Decorators, filtros e interceptors globais
└── main.ts           # Entry point da aplicação
```

## Deploy

O deploy é feito automaticamente pelo [Render](https://render.com) a cada push na branch `main`.

> **Atenção:** o plano gratuito do Render hiberna após 15 minutos de inatividade. A primeira requisição após esse período pode levar até 60 segundos. Esse comportamento é esperado na fase de validação.

## Banco de dados

O banco de dados PostgreSQL é gerenciado pelo [Neon](https://neon.tech). Para backup manual:

```bash
pg_dump "postgresql://usuario:senha@host.neon.tech/corretor-db?sslmode=require" > backup.sql
```

Execute periodicamente e guarde o arquivo `.sql` em local seguro.
