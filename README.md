# Paladar Buffet API

API administrativa do Paladar Buffet. Este projeto entrega a fundação backend da versão 1.0.0, com autenticação administrativa, sessões, recuperação de senha, Google Login configurável, Prisma e PostgreSQL.

## Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- Argon2id
- Google OAuth/OIDC
- Resend
- Vitest
- Supertest

## Funcionalidades

- Healthcheck seguro em `GET /health`
- Validação de environment com Zod
- Login administrativo por e-mail e senha
- Google Login para administradores previamente autorizados
- Logout com revogação de sessão
- Consulta da sessão atual
- Recuperação e redefinição de senha
- Sessão via cookie HttpOnly
- CSRF por token pareado em cookie/header
- Rate limiting em rotas sensíveis de autenticação
- Helmet, CORS restrito e limite de payload
- Auditoria mínima de eventos de autenticação
- Prisma schema e migration inicial
- Seed seguro para desenvolvimento
- Recebimento público de solicitações de orçamento em `POST /quote-requests`
- Validação, rate limit e honeypot para solicitações públicas

## Estrutura

```text
src/
  config/
  lib/
  middlewares/
  modules/
    auth/
    quote-requests/
  shared/
  types/
  app.ts
  server.ts
prisma/
  migrations/
  schema.prisma
  seed.ts
tests/
```

## Environments

Crie um `.env` local com base em `.env.example`.

Variáveis principais:

- `DATABASE_URL`
- `DIRECT_URL`
- `APP_URL`
- `WEB_URL`
- `SESSION_SECRET`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_SAME_SITE`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Para provisionamento administrativo:

- `ADMIN_INITIAL_PASSWORD`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run seed`

## Autenticação

Não existe cadastro público. Um usuário administrativo só consegue entrar se existir previamente em `AdminUser`, estiver ativo e tiver role `OWNER` ou `ADMIN`.

No login Google, a identidade confirmada pelo Google deve ter e-mail verificado e `sub` correspondente ao `googleId` previamente cadastrado no `AdminUser`. A API também valida se o e-mail do token bate com o e-mail autorizado. A API não cria administrador automaticamente.

Para Neon, use `DATABASE_URL` como connection string pooled para runtime quando aplicável. Use `DIRECT_URL` com a connection string direta para Prisma Migrate, introspection e operações administrativas de schema. Isso evita executar migrations por um pooler.

Para produção com Web e API em subdomínios do mesmo domínio, configure `SESSION_COOKIE_DOMAIN` de forma compatível, por exemplo `.seudominio.com.br`. Se a topologia usar domínios totalmente diferentes, a estratégia de cookie/CSRF deve ser revisada antes do deploy.

## Desenvolvimento Local

1. Instale as dependências com `npm install`.
2. Configure `.env` usando `.env.example`.
3. Execute `npm run prisma:generate`.
4. Execute as migrations com `npm run prisma:migrate`.
5. Configure `ADMIN_INITIAL_PASSWORD` com uma senha compatível com a política e rode `npm run seed` para provisionar os usuários oficiais.

As instruções acima dependem de um PostgreSQL acessível pelo `DATABASE_URL`.

## Provisionamento Administrativo

O seed não cria conta pública. Ele provisiona somente os sete e-mails oficiais definidos no código, usando `ADMIN_INITIAL_PASSWORD`, armazenada como hash Argon2id individual. O provisionamento pode ser reexecutado: preserva `googleId` e não sobrescreve a senha pessoal depois que `mustChangePassword` se torna `false`.

## Orçamentos Públicos

`POST /quote-requests` recebe solicitações do formulário público do site. A rota não cria usuário, não autentica visitante e retorna apenas um recibo com `id` e `createdAt`.

Campos principais:

- nome
- telefone
- e-mail opcional
- tipo de evento
- data prevista opcional
- horário previsto obrigatório
- quantidade de convidados
- localidade opcional
- observações e preferências
- aceite da política de privacidade

O campo honeypot `website` é aceito apenas como controle anti-spam e não é persistido.
