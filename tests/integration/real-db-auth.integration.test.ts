import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { sha256 } from '../../src/shared/crypto.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { ResendEmailSender } from '../../src/modules/auth/email.sender.js';
import { JoseGoogleIdentityVerifier } from '../../src/modules/auth/google.verifier.js';
import {
  PrismaAdminRepository,
  PrismaAuditRepository,
  PrismaPasswordResetRepository,
  PrismaSessionRepository
} from '../../src/modules/auth/prisma-auth.repositories.js';

const runRealDbTests = process.env.RUN_REAL_DB_TESTS === '1';
const testRunId = `real-db-${Date.now()}`;
const adminEmail = `${testRunId}@paladarbuffet.test`;
const initialPassword = 'StrongPass123';
const resetPassword = 'ResetStrongPass123';

class CaptureEmailSender extends ResendEmailSender {
  public resetUrl = '';

  constructor() {
    super('', '');
  }

  override async sendPasswordReset(input: { to: string; name: string; resetUrl: string }) {
    this.resetUrl = input.resetUrl;
  }
}

describe.runIf(runRealDbTests)('real database admin authentication', () => {
  beforeAll(async () => {
    await prisma.adminUser.create({
      data: {
        name: 'Real DB Test Admin',
        email: adminEmail,
        passwordHash: await argon2.hash(initialPassword, { type: argon2.argon2id }),
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false
      }
    });
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } });
    await prisma.$disconnect();
  });

  it('validates login, session, protected route and logout through HTTP', async () => {
    const app = createApp();

    const loginResponse = await request(app).post('/auth/login').send({
      email: adminEmail,
      password: initialPassword
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.admin.email).toBe(adminEmail);

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
    const csrfCookie = cookies.find((cookie) => cookie.startsWith('paladar_csrf='));
    const csrfToken = csrfCookie?.match(/^paladar_csrf=([^;]+)/)?.[1];
    expect(csrfToken).toBeTruthy();

    const sessionResponse = await request(app).get('/auth/me').set('Cookie', cookies);
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.admin.email).toBe(adminEmail);

    const protectedResponse = await request(app).get('/auth/admin/session-check').set('Cookie', cookies);
    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body).toEqual({ ok: true });

    const logoutResponse = await request(app)
      .post('/auth/logout')
      .set('Cookie', cookies)
      .set('x-csrf-token', decodeURIComponent(csrfToken ?? ''));
    expect(logoutResponse.status).toBe(204);

    const afterLogoutResponse = await request(app).get('/auth/me').set('Cookie', cookies);
    expect(afterLogoutResponse.status).toBe(401);
  });

  it('validates password recovery, reset and session revocation against the database', async () => {
    const emailSender = new CaptureEmailSender();
    const service = new AuthService({
      admins: new PrismaAdminRepository(prisma),
      sessions: new PrismaSessionRepository(prisma),
      passwordResets: new PrismaPasswordResetRepository(prisma),
      audit: new PrismaAuditRepository(prisma),
      emailSender,
      googleVerifier: new JoseGoogleIdentityVerifier(process.env.GOOGLE_CLIENT_ID ?? ''),
      webUrl: process.env.WEB_URL ?? 'http://localhost:5173'
    });

    const login = await service.login({ email: adminEmail, password: initialPassword });
    await service.requestPasswordReset({ email: adminEmail });

    const resetToken = new URL(emailSender.resetUrl).searchParams.get('token') ?? '';
    expect(resetToken).toHaveLength(64);

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(resetToken) }
    });
    expect(tokenRecord?.usedAt).toBeNull();

    await service.resetPassword({ token: resetToken, password: resetPassword });

    const updatedAdmin = await prisma.adminUser.findUniqueOrThrow({ where: { email: adminEmail } });
    expect(await argon2.verify(updatedAdmin.passwordHash ?? '', resetPassword)).toBe(true);

    const usedTokenRecord = await prisma.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: sha256(resetToken) }
    });
    expect(usedTokenRecord.usedAt).toBeInstanceOf(Date);
    await expect(service.currentSession(login.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('requires and completes the initial password change through HTTP', async () => {
    await prisma.adminUser.update({
      where: { email: adminEmail },
      data: {
        passwordHash: await argon2.hash(initialPassword, { type: argon2.argon2id }),
        mustChangePassword: true
      }
    });
    const app = createApp();
    const loginResponse = await request(app).post('/auth/login').send({
      email: adminEmail,
      password: initialPassword
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.admin.mustChangePassword).toBe(true);

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
    const csrfCookie = cookies.find((cookie) => cookie.startsWith('paladar_csrf='));
    const csrfToken = decodeURIComponent(csrfCookie?.match(/^paladar_csrf=([^;]+)/)?.[1] ?? '');

    const blockedResponse = await request(app).get('/auth/admin/session-check').set('Cookie', cookies);
    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changeResponse = await request(app)
      .post('/auth/change-password')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken)
      .send({ currentPassword: initialPassword, newPassword: resetPassword });
    expect(changeResponse.status).toBe(204);

    const updatedAdmin = await prisma.adminUser.findUniqueOrThrow({ where: { email: adminEmail } });
    expect(updatedAdmin.mustChangePassword).toBe(false);
    expect(await argon2.verify(updatedAdmin.passwordHash ?? '', resetPassword)).toBe(true);
    const revokedSessionResponse = await request(app).get('/auth/me').set('Cookie', cookies);
    expect(revokedSessionResponse.status).toBe(401);

    const secondLogin = await request(app).post('/auth/login').send({
      email: adminEmail,
      password: resetPassword
    });
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.admin.mustChangePassword).toBe(false);
  });
});
