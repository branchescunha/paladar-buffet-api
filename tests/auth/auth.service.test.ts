import argon2 from 'argon2';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../src/shared/crypto.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import {
  InMemoryAdminRepository,
  InMemoryAuditRepository,
  InMemoryPasswordResetRepository,
  InMemorySessionRepository,
  MemoryEmailSender,
  StaticGoogleVerifier,
  makeAdmin
} from './in-memory-auth.js';

async function makeService(options: { inactive?: boolean; googleEmail?: string } = {}) {
  const passwordHash = await argon2.hash('StrongPass123', { type: argon2.argon2id });
  const admins = [
    makeAdmin({
      passwordHash,
      isActive: !options.inactive
    })
  ];
  const adminRepo = new InMemoryAdminRepository(admins);
  const sessions = new InMemorySessionRepository(admins);
  const resets = new InMemoryPasswordResetRepository();
  const audit = new InMemoryAuditRepository();
  const email = new MemoryEmailSender();
  const service = new AuthService({
    admins: adminRepo,
    sessions,
    passwordResets: resets,
    audit,
    emailSender: email,
    googleVerifier: new StaticGoogleVerifier({
      email: options.googleEmail ?? 'admin@paladarbuffet.com.br',
      googleId: 'google-1'
    }),
    webUrl: 'http://localhost:5173'
  });

  return { service, admins, sessions, resets, audit, email };
}

describe('AuthService', () => {
  it('creates a session for a valid active admin using e-mail and password', async () => {
    const { service, sessions } = await makeService();

    const result = await service.login({
      email: 'ADMIN@paladarbuffet.com.br',
      password: 'StrongPass123'
    });

    expect(result.admin.email).toBe('admin@paladarbuffet.com.br');
    expect(result.sessionToken).toHaveLength(64);
    expect(sessions.sessions).toHaveLength(1);
  });

  it('uses the same error for an unknown user and a wrong password', async () => {
    const { service } = await makeService();

    await expect(service.login({ email: 'missing@paladarbuffet.com.br', password: 'StrongPass123' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS'
    });
    await expect(service.login({ email: 'admin@paladarbuffet.com.br', password: 'wrong-password' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS'
    });
  });

  it('rejects inactive admins', async () => {
    const { service } = await makeService({ inactive: true });

    await expect(service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' })).rejects.toMatchObject({
      statusCode: 401
    });
  });

  it('returns the current session only when the session is active', async () => {
    const { service } = await makeService();
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    await expect(service.currentSession(login.sessionToken)).resolves.toMatchObject({
      admin: { email: 'admin@paladarbuffet.com.br' }
    });
    await expect(service.currentSession('invalid-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an expired session', async () => {
    const { service, sessions } = await makeService();
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });
    sessions.sessions[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.currentSession(login.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('revokes the session on logout', async () => {
    const { service } = await makeService();
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    await service.logout(login.sessionToken);

    await expect(service.currentSession(login.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('does not enumerate users when requesting password recovery', async () => {
    const { service, email } = await makeService();

    await service.requestPasswordReset({ email: 'missing@paladarbuffet.com.br' });

    expect(email.messages).toHaveLength(0);
  });

  it('creates a password reset token for an active admin and consumes it once', async () => {
    const { service, email, admins } = await makeService();

    await service.requestPasswordReset({ email: 'admin@paladarbuffet.com.br' });
    const url = new URL(email.messages[0].resetUrl);
    const token = url.searchParams.get('token') ?? '';
    await service.resetPassword({ token, password: 'NewStrongPass123' });

    expect(await argon2.verify(admins[0].passwordHash ?? '', 'NewStrongPass123')).toBe(true);
    await expect(service.resetPassword({ token, password: 'NewStrongPass123' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects invalid and expired password reset tokens', async () => {
    const { service, resets } = await makeService();
    resets.records.push({
      id: 'expired',
      adminUserId: 'admin-1',
      tokenHash: sha256('expired-token-value-that-is-long-enough'),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date()
    });

    await expect(
      service.resetPassword({ token: 'invalid-token-value-that-is-long-enough', password: 'NewStrongPass123' })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.resetPassword({ token: 'expired-token-value-that-is-long-enough', password: 'NewStrongPass123' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows Google login only for a previously authorized active admin', async () => {
    const { service } = await makeService();

    const result = await service.googleLogin({ idToken: 'valid-google-token' });

    expect(result.admin.email).toBe('admin@paladarbuffet.com.br');
  });

  it('rejects a Google identity that is not an authorized admin', async () => {
    const { service } = await makeService({ googleEmail: 'visitor@gmail.com' });

    await expect(service.googleLogin({ idToken: 'valid-google-token' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
