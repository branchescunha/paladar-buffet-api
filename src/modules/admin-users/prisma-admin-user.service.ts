import type { PrismaClient } from '@prisma/client';
import { forbiddenError, resourceConflictError } from '../../shared/errors.js';
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

  async setActive(id: string, isActive: boolean, actorId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const admin = await transaction.adminUser.findUnique({ where: { id }, select: { id: true, role: true } });
      if (!admin) {
        return null;
      }
      if (!isActive && id === actorId) {
        throw forbiddenError();
      }
      if (!isActive) {
        const activeOthers = await transaction.adminUser.count({ where: { isActive: true, id: { not: id } } });
        if (activeOthers === 0) {
          throw resourceConflictError('Ao menos um administrador deve permanecer ativo.');
        }
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
