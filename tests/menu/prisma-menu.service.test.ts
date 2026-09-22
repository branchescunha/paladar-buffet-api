import { describe, expect, it, vi } from 'vitest';
import { PrismaMenuService } from '../../src/modules/menu/prisma-menu.service.js';

describe('PrismaMenuService deletion safety', () => {
  it('blocks deleting an option referenced by a historical quote snapshot', async () => {
    const prisma = {
      menuOption: { findUnique: vi.fn().mockResolvedValue({ id: 'option-1' }), delete: vi.fn() },
      quoteRequestMenuSelection: { count: vi.fn().mockResolvedValue(1) }
    };
    const service = new PrismaMenuService(prisma as never);

    await expect(service.deleteOption('option-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.menuOption.delete).not.toHaveBeenCalled();
  });

  it('hard deletes an unreferenced option', async () => {
    const prisma = {
      menuOption: { findUnique: vi.fn().mockResolvedValue({ id: 'option-1' }), delete: vi.fn().mockResolvedValue({ id: 'option-1' }) },
      quoteRequestMenuSelection: { count: vi.fn().mockResolvedValue(0) }
    };
    const service = new PrismaMenuService(prisma as never);

    await expect(service.deleteOption('option-1')).resolves.toBe(true);
    expect(prisma.menuOption.delete).toHaveBeenCalledWith({ where: { id: 'option-1' } });
  });
});
