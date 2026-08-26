import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  AdminRepository,
  AuditRepository,
  PasswordResetRepository,
  SessionRepository
} from './auth.types.js';

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.adminUser.findUnique({ where: { email } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.adminUser.findUnique({ where: { googleId } });
  }

  async linkGoogleId(input: { adminUserId: string; email: string; googleId: string; avatarUrl?: string }) {
    try {
      const result = await this.prisma.adminUser.updateMany({
        where: {
          id: input.adminUserId,
          email: input.email,
          googleId: null,
          isActive: true
        },
        data: {
          googleId: input.googleId,
          avatarUrl: input.avatarUrl,
          version: { increment: 1 }
        }
      });

      if (result.count !== 1) {
        return null;
      }

      return this.prisma.adminUser.findUnique({ where: { id: input.adminUserId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }

      throw error;
    }
  }

  async updateLastLogin(adminUserId: string) {
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { lastLoginAt: new Date(), version: { increment: 1 } }
    });
  }

  async updatePassword(adminUserId: string, passwordHash: string) {
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { passwordHash, version: { increment: 1 } }
    });
  }
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: {
    adminUserId: string;
    tokenHash: string;
    csrfTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return this.prisma.adminSession.create({ data: input });
  }

  findActiveByTokenHash(tokenHash: string, now: Date) {
    return this.prisma.adminSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      include: { adminUser: true }
    });
  }

  async revoke(sessionId: string) {
    await this.prisma.adminSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  async revokeAllForAdmin(adminUserId: string) {
    await this.prisma.adminSession.updateMany({
      where: { adminUserId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async touch(sessionId: string) {
    await this.prisma.adminSession.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } });
  }
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { adminUserId: string; tokenHash: string; expiresAt: Date }) {
    await this.prisma.passwordResetToken.create({ data: input });
  }

  findByTokenHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async consumeValidToken(tokenHash: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now }
        }
      });

      if (!token) {
        return null;
      }

      const result = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now }
      });

      return result.count === 1 ? token : null;
    });
  }

  async markUsed(tokenId: string) {
    await this.prisma.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
  }
}

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: {
    type: Parameters<AuditRepository['record']>[0]['type'];
    adminUserId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.authAuditEvent.create({
      data: {
        type: input.type,
        adminUserId: input.adminUserId,
        email: input.email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }
}
