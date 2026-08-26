import argon2 from 'argon2';
import { daysFromNow, minutesFromNow } from '../../shared/time.js';
import { createSecureToken, sha256 } from '../../shared/crypto.js';
import { forbiddenError, invalidCredentialsError, unauthorizedError } from '../../shared/errors.js';
import { normalizeEmail, passwordSchema } from './password-policy.js';
import type {
  AdminRepository,
  AdminSession,
  AuditRepository,
  EmailSender,
  GoogleIdentityVerifier,
  PasswordResetRepository,
  RequestMetadata,
  SessionRepository
} from './auth.types.js';

export interface AuthServiceDependencies {
  admins: AdminRepository;
  sessions: SessionRepository;
  passwordResets: PasswordResetRepository;
  audit: AuditRepository;
  emailSender: EmailSender;
  googleVerifier: GoogleIdentityVerifier;
  webUrl: string;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDependencies) {}

  async login(input: { email: string; password: string } & RequestMetadata) {
    const email = normalizeEmail(input.email);
    const admin = await this.deps.admins.findByEmail(email);

    if (!admin || !admin.isActive || !admin.passwordHash) {
      await this.deps.audit.record({ type: 'LOGIN_DENIED', email, ...this.metadata(input) });
      throw invalidCredentialsError();
    }

    const passwordMatches = await argon2.verify(admin.passwordHash, input.password);

    if (!passwordMatches) {
      await this.deps.audit.record({ type: 'LOGIN_DENIED', adminUserId: admin.id, email, ...this.metadata(input) });
      throw invalidCredentialsError();
    }

    const session = await this.createSession(admin.id, input);
    await this.deps.admins.updateLastLogin(admin.id);
    await this.deps.audit.record({ type: 'LOGIN_SUCCESS', adminUserId: admin.id, email, ...this.metadata(input) });

    return { admin: this.publicAdmin(admin), ...session };
  }

  async googleLogin(input: { idToken: string } & RequestMetadata) {
    const identity = await this.deps.googleVerifier.verify(input.idToken);
    const email = normalizeEmail(identity.email);
    const admin = await this.deps.admins.findByGoogleId(identity.googleId);

    if (!identity.emailVerified || !admin || !admin.isActive || admin.email !== email) {
      await this.deps.audit.record({
        type: 'GOOGLE_LOGIN_DENIED',
        email,
        metadata: { googleId: identity.googleId },
        ...this.metadata(input)
      });
      throw forbiddenError();
    }

    const session = await this.createSession(admin.id, input);
    await this.deps.admins.updateLastLogin(admin.id);
    await this.deps.audit.record({ type: 'GOOGLE_LOGIN_SUCCESS', adminUserId: admin.id, email, ...this.metadata(input) });

    return { admin: this.publicAdmin(admin), ...session };
  }

  async currentSession(sessionToken: string | undefined) {
    if (!sessionToken) {
      throw unauthorizedError();
    }

    const session = await this.deps.sessions.findActiveByTokenHash(sha256(sessionToken), new Date());

    if (!session?.adminUser || !session.adminUser.isActive) {
      throw unauthorizedError();
    }

    await this.deps.sessions.touch(session.id);
    return { session, admin: this.publicAdmin(session.adminUser) };
  }

  async logout(sessionToken: string | undefined, metadata: RequestMetadata = {}) {
    if (!sessionToken) {
      return;
    }

    const session = await this.deps.sessions.findActiveByTokenHash(sha256(sessionToken), new Date());

    if (session) {
      await this.deps.sessions.revoke(session.id);
      await this.deps.audit.record({ type: 'LOGOUT', adminUserId: session.adminUserId, ...metadata });
    }
  }

  async validateCsrf(sessionToken: string | undefined, csrfToken: string | undefined) {
    if (!sessionToken || !csrfToken) {
      throw forbiddenError();
    }

    const session = await this.deps.sessions.findActiveByTokenHash(sha256(sessionToken), new Date());

    if (!session || session.csrfTokenHash !== sha256(csrfToken)) {
      throw forbiddenError();
    }
  }

  async requestPasswordReset(input: { email: string } & RequestMetadata) {
    const email = normalizeEmail(input.email);
    const admin = await this.deps.admins.findByEmail(email);

    if (admin?.isActive) {
      const token = createSecureToken(48);
      const resetUrl = `${this.deps.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await this.deps.passwordResets.create({
        adminUserId: admin.id,
        tokenHash: sha256(token),
        expiresAt: minutesFromNow(30)
      });
      await this.deps.emailSender.sendPasswordReset({ to: admin.email, name: admin.name, resetUrl });
      await this.deps.audit.record({
        type: 'PASSWORD_RESET_REQUESTED',
        adminUserId: admin.id,
        email,
        ...this.metadata(input)
      });
    }
  }

  async resetPassword(input: { token: string; password: string } & RequestMetadata) {
    const parsedPassword = passwordSchema.parse(input.password);
    const record = await this.deps.passwordResets.consumeValidToken(sha256(input.token), new Date());

    if (!record) {
      throw forbiddenError();
    }

    const passwordHash = await argon2.hash(parsedPassword, { type: argon2.argon2id });
    await this.deps.admins.updatePassword(record.adminUserId, passwordHash);
    await this.deps.sessions.revokeAllForAdmin(record.adminUserId);
    await this.deps.audit.record({
      type: 'PASSWORD_RESET_COMPLETED',
      adminUserId: record.adminUserId,
      ...this.metadata(input)
    });
  }

  private async createSession(adminUserId: string, metadata: RequestMetadata) {
    const sessionToken = createSecureToken(48);
    const csrfToken = createSecureToken(32);
    const session = await this.deps.sessions.create({
      adminUserId,
      tokenHash: sha256(sessionToken),
      csrfTokenHash: sha256(csrfToken),
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      expiresAt: daysFromNow(7)
    });

    return { session, sessionToken, csrfToken };
  }

  private publicAdmin(admin: AdminSession['adminUser']) {
    if (!admin) {
      throw unauthorizedError();
    }

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatarUrl: admin.avatarUrl
    };
  }

  private metadata(input: RequestMetadata): RequestMetadata {
    return { ipAddress: input.ipAddress, userAgent: input.userAgent };
  }
}
