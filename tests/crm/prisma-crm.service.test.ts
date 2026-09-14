import { describe, expect, it, vi } from 'vitest';
import { PrismaCustomerService } from '../../src/modules/crm/prisma-crm.service.js';

describe('PrismaCustomerService', () => {
  it('persists cleared optional customer fields as null', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: 'customer-1', email: null, notes: null });
    const service = new PrismaCustomerService({
      customer: { updateMany, findUnique }
    } as never);

    await service.update('customer-1', { email: null, notes: null });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: { email: null, notes: null }
    });
  });
});
