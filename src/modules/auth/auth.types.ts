export type AdminRole = 'OWNER' | 'ADMIN';

export type AuthEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_DENIED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_CHANGED'
  | 'GOOGLE_LOGIN_SUCCESS'
  | 'GOOGLE_LOGIN_DENIED';

export interface AdminUser {
  id: string;
  name: string;
  commercialTitle: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  avatarUrl: string | null;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  version: number;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  tokenHash: string;
  csrfTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastSeenAt: Date;
  adminUser?: AdminUser;
}

export interface PasswordResetTokenRecord {
  id: string;
  adminUserId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findByGoogleId(googleId: string): Promise<AdminUser | null>;
  findById(adminUserId: string): Promise<AdminUser | null>;
  linkGoogleId(input: { adminUserId: string; email: string; googleId: string; avatarUrl?: string }): Promise<AdminUser | null>;
  updateLastLogin(adminUserId: string): Promise<void>;
  updatePassword(adminUserId: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
}

export interface SessionRepository {
  create(input: {
    adminUserId: string;
    tokenHash: string;
    csrfTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<AdminSession>;
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<AdminSession | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForAdmin(adminUserId: string): Promise<void>;
  touch(sessionId: string): Promise<void>;
}

export interface PasswordResetRepository {
  create(input: { adminUserId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  consumeValidToken(tokenHash: string, now: Date): Promise<PasswordResetTokenRecord | null>;
  markUsed(tokenId: string): Promise<void>;
}

export interface AuditRepository {
  record(input: {
    type: AuthEventType;
    adminUserId?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  } & RequestMetadata): Promise<void>;
}

export interface EmailSender {
  sendPasswordReset(input: { to: string; name: string; resetUrl: string }): Promise<void>;
}

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<{ email: string; emailVerified: boolean; googleId: string; name?: string; avatarUrl?: string }>;
}
