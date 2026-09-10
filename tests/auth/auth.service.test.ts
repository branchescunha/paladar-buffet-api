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

async function makeService(
  options: {
    inactive?: boolean;
    googleEmail?: string;
    googleId?: string;
    adminGoogleId?: string | null;
    emailVerified?: boolean;
    mustChangePassword?: boolean;
    role?: 'OWNER' | 'ADMIN';
  } = {}
) {
  const passwordHash = await argon2.hash('StrongPass123', { type: argon2.argon2id });
  const admins = [
    makeAdmin({
      passwordHash,
      googleId: options.adminGoogleId === undefined ? 'google-1' : options.adminGoogleId,
      isActive: !options.inactive,
      mustChangePassword: options.mustChangePassword ?? false,
      role: options.role ?? 'ADMIN'
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
      googleId: options.googleId ?? 'google-1',
      emailVerified: options.emailVerified
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
    expect(result.admin.mustChangePassword).toBe(false);
  });

  it('keeps the initial password change requirement after password login', async () => {
    const { service } = await makeService({ mustChangePassword: true });

    const result = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    expect(result.admin.mustChangePassword).toBe(true);
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

  it('rejects a previously valid session after its admin is deactivated', async () => {
    const { service, admins } = await makeService();
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });
    admins[0].isActive = false;

    await expect(service.currentSession(login.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
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

  it('validates csrf tokens against the persisted session hash', async () => {
    const { service } = await makeService();
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    await expect(service.validateCsrf(login.sessionToken, login.csrfToken)).resolves.toBeUndefined();
    await expect(service.validateCsrf(login.sessionToken, 'wrong-csrf-token')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('does not enumerate users when requesting password recovery', async () => {
    const { service, email } = await makeService();

    await service.requestPasswordReset({ email: 'missing@paladarbuffet.com.br' });

    expect(email.messages).toHaveLength(0);
  });

  it('creates a password reset token for an active admin and consumes it once', async () => {
    const { service, email, admins, sessions } = await makeService();
    const activeLogin = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    await service.requestPasswordReset({ email: 'admin@paladarbuffet.com.br' });
    const url = new URL(email.messages[0].resetUrl);
    const token = url.searchParams.get('token') ?? '';
    await service.resetPassword({ token, password: 'NewStrongPass123' });

    expect(await argon2.verify(admins[0].passwordHash ?? '', 'NewStrongPass123')).toBe(true);
    expect(admins[0].mustChangePassword).toBe(false);
    expect(sessions.sessions[0].revokedAt).toBeInstanceOf(Date);
    await expect(service.currentSession(activeLogin.sessionToken)).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.resetPassword({ token, password: 'NewStrongPass123' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('changes the password with the current password and revokes active sessions', async () => {
    const { service, admins, sessions } = await makeService({ mustChangePassword: true });
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    await service.changePassword({
      sessionToken: login.sessionToken,
      currentPassword: 'StrongPass123',
      newPassword: 'ChangedPass123'
    });

    expect(await argon2.verify(admins[0].passwordHash ?? '', 'ChangedPass123')).toBe(true);
    expect(admins[0].mustChangePassword).toBe(false);
    expect(sessions.sessions[0].revokedAt).toBeInstanceOf(Date);
  });

  it('rejects password change when the current password is invalid', async () => {
    const { service } = await makeService({ mustChangePassword: true });
    const login = await service.login({ email: 'admin@paladarbuffet.com.br', password: 'StrongPass123' });

    await expect(
      service.changePassword({
        sessionToken: login.sessionToken,
        currentPassword: 'WrongPass123',
        newPassword: 'ChangedPass123'
      })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
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

  it('keeps the initial password change requirement after Google login', async () => {
    const { service } = await makeService({ mustChangePassword: true });

    const result = await service.googleLogin({ idToken: 'valid-google-token' });

    expect(result.admin.mustChangePassword).toBe(true);
  });

  it('links the Google subject to a previously authorized active admin on first Google login', async () => {
    const { service, admins } = await makeService({ adminGoogleId: null });

    const result = await service.googleLogin({ idToken: 'valid-google-token' });

    expect(result.admin.email).toBe('admin@paladarbuffet.com.br');
    expect(admins[0].googleId).toBe('google-1');
  });

  it('rejects Google login when the authorized admin is linked to another subject', async () => {
    const { service } = await makeService({ adminGoogleId: 'google-existing', googleId: 'google-1' });

    await expect(service.googleLogin({ idToken: 'valid-google-token' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a Google identity that is not an authorized admin', async () => {
    const { service } = await makeService({ googleEmail: 'visitor@gmail.com' });

    await expect(service.googleLogin({ idToken: 'valid-google-token' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a Google identity with an unknown subject', async () => {
    const { service } = await makeService({ googleId: 'google-2' });

    await expect(service.googleLogin({ idToken: 'valid-google-token' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a Google identity with an unverified email', async () => {
    const { service } = await makeService({ emailVerified: false });

    await expect(service.googleLogin({ idToken: 'valid-google-token' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
