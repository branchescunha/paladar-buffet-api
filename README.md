# Paladar Buffet API

## Descrição

API REST do Paladar Buffet para receber solicitações públicas de orçamento e sustentar a operação comercial administrativa. Gerencia autenticação, clientes, eventos, cardápio, formas de pagamento e propostas, com persistência em PostgreSQL via Prisma.

## Funcionalidades

- Recebimento e validação de solicitações de orçamento, incluindo seleção de cardápio e consentimento de privacidade.
- Autenticação de administradores autorizados, sessões revogáveis, recuperação e troca de senha.
- Autorização por papel para ações administrativas e gestão das contas existentes.
- Gestão de solicitações, clientes e eventos, com conversão de solicitações e regras de integridade na exclusão.
- Catálogo de cardápio com grupos, seções, opções e limites de seleção; gestão de formas de pagamento.
- Propostas por convidado (`PER_GUEST`) e compatibilidade com propostas legadas por itens (`ITEMIZED`).
- Cálculos monetários em centavos no servidor, parcelas, serviços e snapshots comerciais que preservam o histórico.
- Geração protegida de propostas em PDF.
- Validação de entrada com Zod, proteção CSRF nas mutações administrativas e limites de requisição.

## Tecnologias

Node.js, TypeScript, Express, PostgreSQL, Prisma ORM 6.19.3 com `@prisma/adapter-pg` e `pg`, Zod, Argon2, PDFKit, Pino, Vitest e Supertest.

## Estrutura

```text
src/
  config/       configuração e validação de ambiente
  lib/          infraestrutura compartilhada e Prisma Client
  middlewares/  logs, identificação de requisições e erros
  modules/      autenticação, solicitações, CRM, cardápio,
                pagamentos, propostas e dashboard
  shared/       erros e utilitários comuns
  types/        extensões de tipos
prisma/
  migrations/   histórico versionado do schema
  schema.prisma modelos e relacionamentos
tests/          testes unitários, HTTP e de integração
```

## Autor

André Vinícius Branches Cunha
