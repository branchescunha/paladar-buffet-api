# Paladar Buffet API

API REST do Paladar Buffet responsável por autenticação administrativa, recebimento de solicitações públicas e operação dos módulos comerciais do produto.

## Funcionalidades

- Recebimento público de solicitações de orçamento
- Catálogo público de cardápio com regras de seleção
- Autenticação administrativa por senha e Google
- Sessões, recuperação e troca de senha
- Dashboard operacional
- Gestão de solicitações, clientes e eventos
- Conversão segura de solicitações em cliente e evento
- Gestão de cardápios e formas de pagamento
- Propostas por itens (`ITEMIZED`) e por convidado (`PER_GUEST`)
- Cálculos monetários no backend em centavos
- Snapshots comerciais de cardápio, pagamentos e responsável
- Geração de proposta profissional em PDF
- Exclusão administrativa protegida por integridade referencial
- Provisionamento idempotente das contas administrativas autorizadas

## Principais módulos

- **Auth:** login, Google Login, sessões, CSRF e recuperação de senha
- **Quote Requests:** entrada pública, validação, status e detalhes administrativos
- **CRM:** clientes, eventos e conversão de solicitações
- **Menu:** grupos, seções, opções e regras de seleção
- **Payment Methods:** formas de pagamento, instruções e Pix
- **Proposals:** criação, edição, status, preços, parcelas e snapshots
- **Proposal PDF:** documento A4 para propostas por itens ou por convidado
- **Admin Users:** perfil e administração das contas autorizadas
- **Dashboard:** indicadores e registros recentes

## Arquitetura

A aplicação usa módulos orientados por domínio. As rotas Express validam entrada e autorização, os serviços concentram regras de negócio e os repositórios Prisma realizam a persistência no PostgreSQL.

```text
src/
  config/       validação de ambiente
  lib/          infraestrutura compartilhada
  middlewares/  logs, request ID e tratamento de erros
  modules/      módulos de domínio e rotas HTTP
  shared/       erros, criptografia e utilitários
  types/        extensões de tipos
prisma/
  migrations/   histórico versionado do banco
  schema.prisma modelos e relacionamentos
tests/          testes unitários, HTTP e integração
```

## Segurança

- Senhas com Argon2id
- Sessões em cookie HttpOnly com revogação server-side
- Proteção CSRF nas mutações administrativas
- Google Login restrito a contas previamente autorizadas e e-mail verificado
- Rate limiting em autenticação e solicitações públicas
- Helmet, CORS restrito e limite de payload
- Zod nos contratos de entrada
- Queries parametrizadas pelo Prisma
- Logs estruturados com campos sensíveis redigidos
- Respostas de erro sem stack trace ou detalhes internos
- Nenhum cadastro público de administrador

## Persistência comercial

O PostgreSQL armazena solicitações, clientes, eventos, propostas e configurações comerciais. Valores financeiros são representados em centavos e recalculados no backend. Propostas preservam snapshots dos dados comerciais para manter o histórico mesmo após mudanças no catálogo.

O Prisma Client utiliza o adaptador PostgreSQL sem engine Rust. A URL pooled atende o runtime e a URL direta é reservada às operações de schema e migrations.

## Tecnologias

- Node.js
- Express
- TypeScript
- Prisma ORM e PostgreSQL
- `@prisma/adapter-pg`
- Zod
- Argon2id
- Google OAuth/OIDC
- Resend
- PDFKit
- Pino
- Vitest e Supertest

## Autor

[André Branches](https://github.com/branchescunha)
