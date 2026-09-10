import { describe, expect, it, vi } from 'vitest';
import { PrismaAdminUserManagementService } from '../../src/modules/admin-users/prisma-admin-user.service.js';

function makePrisma(role: 'OWNER' | 'ADMIN' = 'ADMIN') {
  const findUnique = vi.fn().mockResolvedValue({ id: 'admin-1', role });
  const update = vi.fn().mockResolvedValue({ id: 'admin-1', name: 'Ana', email: 'ana@paladarbuffet.com', role, isActive: false });
  const updateMany = vi.fn().mockResolvedValue({ count: 2 });
  const transaction = { adminUser: { findUnique, update }, adminSession: { updateMany } };
  return {
    prisma: { $transaction: vi.fn((callback) => callback(transaction)), adminUser: { findMany: vi.fn() } } as never,
    findUnique,
    update,
    updateMany
  };
}

describe('PrismaAdminUserManagementService', () => {
  it('deactivates an ADMIN and revokes every active session in the same transaction', async () => {
    const { prisma, update, updateMany } = makePrisma();
    const service = new PrismaAdminUserManagementService(prisma);

    const result = await service.setActive('admin-1', false);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { adminUserId: 'admin-1', revokedAt: null } }));
    expect(result).toMatchObject({ id: 'admin-1', isActive: false });
  });

  it('reactivates an ADMIN without revoking sessions', async () => {
    const { prisma, updateMany } = makePrisma();
    const service = new PrismaAdminUserManagementService(prisma);

    await service.setActive('admin-1', true);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects attempts to change an OWNER activity state', async () => {
    const { prisma, update, updateMany } = makePrisma('OWNER');
    const service = new PrismaAdminUserManagementService(prisma);

    await expect(service.setActive('owner-1', false)).rejects.toMatchObject({ statusCode: 403 });

    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
