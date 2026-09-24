import { describe, expect, it, vi } from 'vitest';
import { PrismaAdminUserManagementService } from '../../src/modules/admin-users/prisma-admin-user.service.js';

function makePrisma(role: 'OWNER' | 'ADMIN' = 'ADMIN', activeOthers = 1) {
  const findUnique = vi.fn().mockResolvedValue({ id: 'admin-1', role });
  const update = vi.fn().mockResolvedValue({ id: 'admin-1', name: 'Ana', email: 'ana@paladarbuffet.com', role, isActive: false });
  const updateMany = vi.fn().mockResolvedValue({ count: 2 });
  const count = vi.fn().mockResolvedValue(activeOthers);
  const transaction = { adminUser: { findUnique, update, count }, adminSession: { updateMany } };
  return {
    prisma: { $transaction: vi.fn((callback) => callback(transaction)), adminUser: { findMany: vi.fn() } } as never,
    findUnique,
    update,
    updateMany,
    count
  };
}

describe('PrismaAdminUserManagementService', () => {
  it('updates name and commercial title without changing the authorization role', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'admin-1', name: 'Lethicia Byanca Santos Cunha', commercialTitle: 'Gerente Administrativo', email: 'lethicia@example.com', role: 'ADMIN', isActive: true });
    const service = new PrismaAdminUserManagementService({ adminUser: { update } } as never);

    const result = await service.updateOwnProfile('admin-1', {
      name: 'Lethicia Byanca Santos Cunha',
      commercialTitle: 'Gerente Administrativo'
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'admin-1' },
      data: { name: 'Lethicia Byanca Santos Cunha', commercialTitle: 'Gerente Administrativo' }
    }));
    expect(result).toMatchObject({ role: 'ADMIN', commercialTitle: 'Gerente Administrativo' });
  });

  it('deactivates an ADMIN and revokes every active session in the same transaction', async () => {
    const { prisma, update, updateMany } = makePrisma();
    const service = new PrismaAdminUserManagementService(prisma);

    const result = await service.setActive('admin-1', false, 'admin-2');

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { adminUserId: 'admin-1', revokedAt: null } }));
    expect(result).toMatchObject({ id: 'admin-1', isActive: false });
  });

  it('reactivates an ADMIN without revoking sessions', async () => {
    const { prisma, updateMany } = makePrisma();
    const service = new PrismaAdminUserManagementService(prisma);

    await service.setActive('admin-1', true, 'admin-2');

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('allows a legacy OWNER to be managed as an administrator', async () => {
    const { prisma, update, updateMany } = makePrisma('OWNER');
    const service = new PrismaAdminUserManagementService(prisma);

    await service.setActive('admin-1', false, 'admin-2');

    expect(update).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalled();
  });

  it('rejects self-deactivation', async () => {
    const { prisma, update } = makePrisma();
    const service = new PrismaAdminUserManagementService(prisma);

    await expect(service.setActive('admin-1', false, 'admin-1')).rejects.toMatchObject({ statusCode: 403 });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects deactivating the last active administrator', async () => {
    const { prisma, update } = makePrisma('ADMIN', 0);
    const service = new PrismaAdminUserManagementService(prisma);

    await expect(service.setActive('admin-1', false, 'admin-2')).rejects.toMatchObject({ statusCode: 409 });
    expect(update).not.toHaveBeenCalled();
  });
});
