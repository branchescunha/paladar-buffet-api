import { describe, expect, it, vi } from 'vitest';
import { PrismaProposalService } from '../../src/modules/proposals/prisma-proposal.service.js';
import { proposalInputSchema } from '../../src/modules/proposals/proposal.schemas.js';

const perGuestPayload = {
  customerId: 'customer-1',
  eventId: 'event-1',
  quoteRequestId: 'quote-1',
  description: 'Casamento completo',
  validUntil: '2026-10-07',
  pricingMode: 'PER_GUEST',
  guestCount: 120,
  pricePerGuestCents: 18990,
  adjustmentCents: -50000,
  includedServices: ['Buffet', 'Garçons', 'Maître']
};

describe('per-guest proposal persistence', () => {
  it('parses a per-guest proposal without requiring priced items', () => {
    expect(proposalInputSchema.parse(perGuestPayload)).toMatchObject({
      pricingMode: 'PER_GUEST',
      items: [],
      includedServices: ['Buffet', 'Garçons', 'Maître']
    });
  });

  it('persists backend totals, included services, default 50/50 and the responsible admin', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: 'proposal-1', ...data }));
    const transaction = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      event: { findUnique: vi.fn().mockResolvedValue({ id: 'event-1', customerId: 'customer-1' }) },
      quoteRequest: { findUnique: vi.fn().mockResolvedValue({ id: 'quote-1', customerId: 'customer-1', event: { id: 'event-1', customerId: 'customer-1' } }) },
      proposal: { create }
    };
    const prisma = { $transaction: <T>(callback: (client: typeof transaction) => Promise<T>) => callback(transaction) };
    const service = new PrismaProposalService(prisma as never);

    await service.create(proposalInputSchema.parse(perGuestPayload), 'admin-1');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pricingMode: 'PER_GUEST',
        guestCount: 120,
        pricePerGuestCents: 18990,
        baseTotalCents: 2278800,
        subtotalCents: 2278800,
        adjustmentCents: -50000,
        totalCents: 2228800,
        responsibleAdminId: 'admin-1',
        items: { create: [] },
        includedServices: { create: [
          { description: 'Buffet', position: 0 },
          { description: 'Garçons', position: 1 },
          { description: 'Maître', position: 2 }
        ] },
        paymentInstallments: { create: [
          { description: 'Na contratação', percentage: 50, position: 0 },
          { description: 'No dia do evento', percentage: 50, position: 1 }
        ] }
      })
    }));
  });

  it('keeps the legacy itemized input valid', () => {
    const parsed = proposalInputSchema.parse({
      customerId: 'customer-1',
      validUntil: '2026-10-07',
      adjustmentCents: 0,
      items: [{ description: 'Buffet completo', quantity: 100, unitPriceCents: 15000 }]
    });

    expect(parsed).toMatchObject({ pricingMode: 'ITEMIZED' });
    expect(parsed).not.toHaveProperty('guestCount');
    expect(parsed).not.toHaveProperty('pricePerGuestCents');
  });
});
