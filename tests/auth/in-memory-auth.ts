import type {
  AdminRepository,
  AdminSession,
  AdminUser,
  AuditRepository,
  AuthEventType,
  EmailSender,
  GoogleIdentityVerifier,
  PasswordResetRepository,
  PasswordResetTokenRecord,
  SessionRepository
} from '../../src/modules/auth/auth.types.js';

export function makeAdmin(overrides: Partial<AdminUser> = {}): AdminUser {
  const now = new Date();
  return {
    id: 'admin-1',
    name: 'Andre Cunha',
    email: 'admin@paladarbuffet.com.br',
    passwordHash: null,
    googleId: null,
    avatarUrl: null,
    role: 'ADMIN',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    version: 1,
    ...overrides
  };
}

export class InMemoryAdminRepository implements AdminRepository {
  constructor(public readonly admins: AdminUser[]) {}

  async findByEmail(email: string) {
    return this.admins.find((admin) => admin.email === email) ?? null;
  }

  async findByGoogleId(googleId: string) {
    return this.admins.find((admin) => admin.googleId === googleId) ?? null;
  }

  async updateLastLogin(adminUserId: string) {
    const admin = this.admins.find((item) => item.id === adminUserId);
    if (admin) {
      admin.lastLoginAt = new Date();
      admin.version += 1;
    }
  }

  async updatePassword(adminUserId: string, passwordHash: string) {
    const admin = this.admins.find((item) => item.id === adminUserId);
    if (admin) {
      admin.passwordHash = passwordHash;
      admin.version += 1;
    }
  }
}

export class InMemorySessionRepository implements SessionRepository {
  public readonly sessions: AdminSession[] = [];

  constructor(private readonly admins: AdminUser[]) {}

  async create(input: {
    adminUserId: string;
    tokenHash: string;
    csrfTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    const session: AdminSession = {
      id: `session-${this.sessions.length + 1}`,
      adminUserId: input.adminUserId,
      tokenHash: input.tokenHash,
      csrfTokenHash: input.csrfTokenHash,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      adminUser: this.admins.find((admin) => admin.id === input.adminUserId)
    };
    this.sessions.push(session);
    return session;
  }

  async findActiveByTokenHash(tokenHash: string, now: Date) {
    return (
      this.sessions.find(
        (session) => session.tokenHash === tokenHash && !session.revokedAt && session.expiresAt > now
      ) ?? null
    );
  }

  async revoke(sessionId: string) {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.revokedAt = new Date();
    }
  }

  async revokeAllForAdmin(adminUserId: string) {
    this.sessions
      .filter((session) => session.adminUserId === adminUserId && !session.revokedAt)
      .forEach((session) => {
        session.revokedAt = new Date();
      });
  }

  async touch(sessionId: string) {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.lastSeenAt = new Date();
    }
  }
}

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  public readonly records: PasswordResetTokenRecord[] = [];

  async create(input: { adminUserId: string; tokenHash: string; expiresAt: Date }) {
    this.records.push({
      id: `reset-${this.records.length + 1}`,
      adminUserId: input.adminUserId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date()
    });
  }

  async findByTokenHash(tokenHash: string) {
    return this.records.find((record) => record.tokenHash === tokenHash) ?? null;
  }

  async consumeValidToken(tokenHash: string, now: Date) {
    const record = this.records.find(
      (item) => item.tokenHash === tokenHash && !item.usedAt && item.expiresAt > now
    );

    if (!record) {
      return null;
    }

    record.usedAt = now;
    return record;
  }

  async markUsed(tokenId: string) {
    const record = this.records.find((item) => item.id === tokenId);
    if (record) {
      record.usedAt = new Date();
    }
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  public readonly events: Array<{ type: AuthEventType; email?: string; adminUserId?: string }> = [];

  async record(input: { type: AuthEventType; email?: string; adminUserId?: string }) {
    this.events.push(input);
  }
}

export class MemoryEmailSender implements EmailSender {
  public readonly messages: Array<{ to: string; resetUrl: string }> = [];

  async sendPasswordReset(input: { to: string; name: string; resetUrl: string }) {
    this.messages.push({ to: input.to, resetUrl: input.resetUrl });
  }
}

export class StaticGoogleVerifier implements GoogleIdentityVerifier {
  constructor(private readonly identity: { email: string; googleId: string; emailVerified?: boolean }) {}

  async verify() {
    return { ...this.identity, emailVerified: this.identity.emailVerified ?? true };
  }
}
