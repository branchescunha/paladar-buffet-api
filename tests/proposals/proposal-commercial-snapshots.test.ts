import { describe, expect, it, vi } from 'vitest';
import { PrismaProposalService } from '../../src/modules/proposals/prisma-proposal.service.js';
import { proposalInputSchema } from '../../src/modules/proposals/proposal.schemas.js';

const menuSelection = {
  groupName: 'Entradas quentes',
  groupPosition: 1,
  sectionName: 'Entradas quentes',
  sectionPosition: 1,
  optionName: 'Fricassê de frango',
  optionPosition: 2
};

const perGuestPayload = {
  customerId: 'customer-1',
  eventId: 'event-1',
  quoteRequestId: 'quote-1',
  description: 'Casamento completo',
  validUntil: '2026-10-07',
  pricingMode: 'PER_GUEST' as const,
  guestCount: 120,
  pricePerGuestCents: 18990,
  adjustmentCents: -50000,
  includedServices: ['Buffet', 'Garçons', 'Maître'],
  paymentMethodIds: ['payment-pix']
};

describe('per-guest proposal commercial snapshots', () => {
  it('defaults a new commercial proposal to per-guest pricing', () => {
    expect(proposalInputSchema.parse({ ...perGuestPayload, pricingMode: undefined })).toMatchObject({ pricingMode: 'PER_GUEST' });
  });

  it('persists backend totals and immutable commercial snapshots', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'proposal-1', ...data, paymentInstallments: data.paymentInstallments.create
    }));
    const transaction = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      event: { findUnique: vi.fn().mockResolvedValue({ id: 'event-1', customerId: 'customer-1' }) },
      quoteRequest: { findUnique: vi.fn().mockResolvedValue({
        id: 'quote-1', customerId: 'customer-1', event: { id: 'event-1', customerId: 'customer-1' }, menuSelections: [menuSelection]
      }) },
      adminUser: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', name: 'André Cunha', role: 'ADMIN' }) },
      paymentMethod: { findMany: vi.fn().mockResolvedValue([
        { id: 'payment-pix', name: 'Pix', pixKey: 'snapshot-key', instructions: 'Na contratação', isActive: true }
      ]) },
      proposal: { create }
    };
    const prisma = { $transaction: <T>(callback: (client: typeof transaction) => Promise<T>) => callback(transaction) };

    const result = await new PrismaProposalService(prisma as never).create(
      proposalInputSchema.parse(perGuestPayload),
      'admin-1'
    ) as { paymentInstallments: Array<{ amountCents: number }> };

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      pricingMode: 'PER_GUEST',
      guestCount: 120,
      pricePerGuestCents: 18990,
      baseTotalCents: 2278800,
      subtotalCents: 2278800,
      adjustmentCents: -50000,
      totalCents: 2228800,
      responsibleAdminId: 'admin-1',
      responsibleNameSnapshot: 'André Cunha',
      responsibleTitleSnapshot: 'Administrador',
      items: { create: [] },
      menuSelections: { create: [menuSelection] },
      paymentMethods: { create: [{
        paymentMethodId: 'payment-pix', name: 'Pix', pixKey: 'snapshot-key', instructions: 'Na contratação', position: 0
      }] }
    }) }));
    expect(result.paymentInstallments.map((item) => item.amountCents)).toEqual([1114400, 1114400]);
  });

  it('creates an idempotent per-guest draft with event guests and menu snapshots', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'proposal-1', ...data, paymentInstallments: data.paymentInstallments.create
    }));
    const transaction = {
      quoteRequest: { findUnique: vi.fn().mockResolvedValue({
        id: 'quote-1', customerId: 'customer-1', eventType: 'casamento',
        event: { id: 'event-1', customerId: 'customer-1', guestCount: 80 },
        menuSelections: [menuSelection]
      }) },
      adminUser: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', name: 'André Cunha', role: 'ADMIN' }) },
      proposal: { findFirst: vi.fn().mockResolvedValue(null), create }
    };
    const prisma = { $transaction: <T>(callback: (client: typeof transaction) => Promise<T>) => callback(transaction) };

    await new PrismaProposalService(prisma as never).createDraftFromQuote('quote-1', 'admin-1');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      pricingMode: 'PER_GUEST',
      guestCount: 80,
      pricePerGuestCents: null,
      responsibleNameSnapshot: 'André Cunha',
      items: { create: [] },
      menuSelections: { create: [menuSelection] }
    }) }));
  });

  it('keeps an existing payment snapshot when the global payment data changes', async () => {
    const historicalSnapshot = {
      paymentMethodId: 'payment-pix', name: 'Pix', pixKey: 'snapshot-key', instructions: 'Instrução histórica'
    };
    const update = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'proposal-1', ...data, paymentInstallments: data.paymentInstallments.create
    }));
    const transaction = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      event: { findUnique: vi.fn().mockResolvedValue({ id: 'event-1', customerId: 'customer-1' }) },
      quoteRequest: { findUnique: vi.fn().mockResolvedValue({
        id: 'quote-1', customerId: 'customer-1', event: { id: 'event-1', customerId: 'customer-1' }, menuSelections: [menuSelection]
      }) },
      paymentMethod: { findMany: vi.fn().mockResolvedValue([
        { id: 'payment-pix', name: 'Pix novo', pixKey: 'new-key', instructions: 'Instrução nova', isActive: true }
      ]) },
      proposal: { findUnique: vi.fn().mockResolvedValue({ id: 'proposal-1', paymentMethods: [historicalSnapshot] }), update }
    };
    const prisma = { $transaction: <T>(callback: (client: typeof transaction) => Promise<T>) => callback(transaction) };

    await new PrismaProposalService(prisma as never).update('proposal-1', proposalInputSchema.parse(perGuestPayload));

    expect(transaction.paymentMethod.findMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      paymentMethods: { deleteMany: {}, create: [{ ...historicalSnapshot, position: 0 }] }
    }) }));
  });

  it('rejects a newly selected inactive payment method', async () => {
    const transaction = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      event: { findUnique: vi.fn().mockResolvedValue({ id: 'event-1', customerId: 'customer-1' }) },
      quoteRequest: { findUnique: vi.fn().mockResolvedValue({
        id: 'quote-1', customerId: 'customer-1', event: { id: 'event-1', customerId: 'customer-1' }, menuSelections: []
      }) },
      adminUser: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', name: 'Admin', role: 'ADMIN' }) },
      paymentMethod: { findMany: vi.fn().mockResolvedValue([]) },
      proposal: { create: vi.fn() }
    };
    const prisma = { $transaction: <T>(callback: (client: typeof transaction) => Promise<T>) => callback(transaction) };

    await expect(new PrismaProposalService(prisma as never).create(
      proposalInputSchema.parse(perGuestPayload),
      'admin-1'
    )).rejects.toThrow('Selecione apenas formas de pagamento ativas.');
    expect(transaction.proposal.create).not.toHaveBeenCalled();
  });

  it('keeps explicit legacy itemized input valid', () => {
    const parsed = proposalInputSchema.parse({
      customerId: 'customer-1',
      validUntil: '2026-10-07',
      pricingMode: 'ITEMIZED',
      adjustmentCents: 0,
      items: [{ description: 'Buffet completo', quantity: 100, unitPriceCents: 15000 }]
    });
    expect(parsed).toMatchObject({ pricingMode: 'ITEMIZED' });
  });
});
