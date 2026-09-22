import { describe, expect, it, vi } from 'vitest';
import { PrismaQuoteRequestRepository } from '../../src/modules/quote-requests/prisma-quote-request.repository.js';
import type { QuoteRequestInput } from '../../src/modules/quote-requests/quote-request.schemas.js';

const input: Omit<QuoteRequestInput, 'website'> = {
  fullName: 'Maria Silva',
  phone: '61999999999',
  eventType: 'casamento',
  eventTypeOther: undefined,
  eventTime: '19:00',
  guestCount: 100,
  preferredContact: 'whatsapp',
  menuPreferences: [],
  serviceNeeds: [],
  menuOptionIds: ['option-hot-1'],
  acceptedPrivacy: true
};

describe('PrismaQuoteRequestRepository menu snapshot persistence', () => {
  it('validates the current catalog and creates the quote with immutable menu snapshots in one transaction', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'quote-1', createdAt: new Date('2026-09-22T12:00:00.000Z') });
    const transaction = {
      menuSelectionGroup: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'group-hot', name: 'Entradas quentes', minSelections: 1, maxSelections: 1, position: 1, isActive: true,
          sections: [{
            id: 'section-hot', name: 'Entradas quentes', position: 1, isActive: true,
            options: [{ id: 'option-hot-1', name: 'Fricassê de frango', position: 1, isActive: true }]
          }]
        }])
      },
      quoteRequest: { create }
    };
    const prisma = { $transaction: <T>(callback: (client: typeof transaction) => Promise<T>) => callback(transaction) };
    const repository = new PrismaQuoteRequestRepository(prisma as never);

    await repository.create(input);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        menuSelections: {
          create: [{
            menuOptionId: 'option-hot-1',
            groupName: 'Entradas quentes',
            groupPosition: 1,
            sectionName: 'Entradas quentes',
            sectionPosition: 1,
            optionName: 'Fricassê de frango',
            optionPosition: 1
          }]
        }
      })
    }));
  });
});
