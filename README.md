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
- Recebimento publico de solicitacoes de orcamento em `POST /quote-requests`
- Validacao, rate limit e honeypot para solicitacoes publicas

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

Variaveis principais:

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

Para Neon, use `DATABASE_URL` como connection string pooled para runtime quando aplicavel. Use `DIRECT_URL` com a connection string direta para Prisma Migrate, introspection e operacoes administrativas de schema. Isso evita executar migrations por um pooler.

Para producao com Web e API em subdominios do mesmo dominio, configure `SESSION_COOKIE_DOMAIN` de forma compativel, por exemplo `.seudominio.com.br`. Se a topologia usar dominios totalmente diferentes, a estrategia de cookie/CSRF deve ser revisada antes do deploy.

## Desenvolvimento Local

1. Instale as dependencias com `npm install`.
2. Configure `.env` usando `.env.example`.
3. Execute `npm run prisma:generate`.
4. Execute as migrations com `npm run prisma:migrate`.
5. Opcionalmente, configure `DEV_ADMIN_EMAIL` e `DEV_ADMIN_PASSWORD` e rode `npm run seed`.

As instrucoes acima dependem de um PostgreSQL acessivel pelo `DATABASE_URL`.

## Seed de Desenvolvimento

O seed nao cria conta publica. Ele apenas garante um `AdminUser` autorizado para desenvolvimento quando as variaveis abaixo estiverem configuradas:

- `DEV_ADMIN_EMAIL`
- `DEV_ADMIN_PASSWORD`
- `DEV_ADMIN_NAME`
- `DEV_ADMIN_GOOGLE_ID`

`DEV_ADMIN_PASSWORD` e sempre armazenada como hash Argon2id. O seed usa `upsert`, portanto pode ser reexecutado com seguranca para o mesmo e-mail. O campo `googleId` so e alterado quando `DEV_ADMIN_GOOGLE_ID` estiver preenchido, evitando apagar uma vinculacao Google existente.

## Orcamentos Publicos

`POST /quote-requests` recebe solicitacoes do formulario publico do site. A rota nao cria usuario, nao autentica visitante e retorna apenas um recibo com `id` e `createdAt`.

Campos principais:

- nome
- telefone
- e-mail opcional
- tipo de evento
- data prevista opcional
- quantidade de convidados
- localidade opcional
- observacoes e preferencias
- aceite da politica de privacidade

O campo honeypot `website` e aceito apenas como controle anti-spam e nao e persistido.
