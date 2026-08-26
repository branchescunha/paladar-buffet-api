# Paladar Buffet API

API administrativa do Paladar Buffet. Este projeto entrega a fundacao backend da versao 1.0.0, com autenticacao administrativa, sessoes, recuperacao de senha, Google Login configuravel, Prisma e PostgreSQL.

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
- Validacao de environment com Zod
- Login administrativo por e-mail e senha
- Google Login para administradores previamente autorizados
- Logout com revogacao de sessao
- Consulta da sessao atual
- Recuperacao e redefinicao de senha
- Sessao via cookie HttpOnly
- CSRF por token pareado em cookie/header
- Rate limiting em rotas sensiveis de autenticacao
- Helmet, CORS restrito e limite de payload
- Auditoria minima de eventos de autenticacao
- Prisma schema e migration inicial
- Seed seguro para desenvolvimento

## Estrutura

```text
src/
  config/
  lib/
  middlewares/
  modules/
    auth/
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

Variaveis principais:

- `DATABASE_URL`
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

Para seed local opcional:

- `DEV_ADMIN_EMAIL`
- `DEV_ADMIN_PASSWORD`
- `DEV_ADMIN_NAME`

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

## Autenticacao

Nao existe cadastro publico. Um usuario administrativo so consegue entrar se existir previamente em `AdminUser`, estiver ativo e tiver role `ADMIN`.

No login Google, a identidade confirmada pelo Google deve ter e-mail verificado e `sub` correspondente ao `googleId` previamente cadastrado no `AdminUser`. A API tambem valida se o e-mail do token bate com o e-mail autorizado. A API nao cria administrador automaticamente.

Para producao com Web e API em subdominios do mesmo dominio, configure `SESSION_COOKIE_DOMAIN` de forma compativel, por exemplo `.seudominio.com.br`. Se a topologia usar dominios totalmente diferentes, a estrategia de cookie/CSRF deve ser revisada antes do deploy.

## Desenvolvimento Local

1. Instale as dependencias com `npm install`.
2. Configure `.env` usando `.env.example`.
3. Execute `npm run prisma:generate`.
4. Execute as migrations com `npm run prisma:migrate`.
5. Opcionalmente, configure `DEV_ADMIN_EMAIL` e `DEV_ADMIN_PASSWORD` e rode `npm run seed`.

As instrucoes acima dependem de um PostgreSQL acessivel pelo `DATABASE_URL`.
