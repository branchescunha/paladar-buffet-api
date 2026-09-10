import type { PrismaClient } from '@prisma/client';
import { forbiddenError } from '../../shared/errors.js';
import type { AdminUserManagementService } from './admin-user.service.js';

const summarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true
} as const;

export class PrismaAdminUserManagementService implements AdminUserManagementService {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.adminUser.findMany({
      select: summarySelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }]
    });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.$transaction(async (transaction) => {
      const admin = await transaction.adminUser.findUnique({ where: { id }, select: { id: true, role: true } });
      if (!admin) {
        return null;
      }
      if (admin.role !== 'ADMIN') {
        throw forbiddenError();
      }

      const updated = await transaction.adminUser.update({
        where: { id },
        data: { isActive, version: { increment: 1 } },
        select: summarySelect
      });

      if (!isActive) {
        await transaction.adminSession.updateMany({
          where: { adminUserId: id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }

      return updated;
    });
  }

  updateOwnName(id: string, name: string) {
    return this.prisma.adminUser.update({
      where: { id },
      data: { name },
      select: summarySelect
    });
  }
}
