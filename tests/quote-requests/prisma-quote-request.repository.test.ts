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

  it('deletes only the quote and its own menu snapshots while preserving derived business records', async () => {
    const database = {
      quoteRequests: ['quote-1'],
      menuSelections: [{ id: 'selection-1', quoteRequestId: 'quote-1' }],
      customers: ['customer-1'],
      events: [{ id: 'event-1', quoteRequestId: 'quote-1' as string | null }],
      proposals: [{ id: 'proposal-1', quoteRequestId: 'quote-1' as string | null }]
    };
    const prisma = {
      quoteRequest: {
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          database.quoteRequests = database.quoteRequests.filter((id) => id !== where.id);
          database.menuSelections = database.menuSelections.filter((item) => item.quoteRequestId !== where.id);
          database.events = database.events.map((item) => item.quoteRequestId === where.id ? { ...item, quoteRequestId: null } : item);
          database.proposals = database.proposals.map((item) => item.quoteRequestId === where.id ? { ...item, quoteRequestId: null } : item);
          return { id: where.id };
        }),
        findMany: vi.fn(async () => database.quoteRequests.map((id) => ({
          id,
          fullName: 'Ana Souza',
          eventType: 'casamento',
          eventTypeOther: null,
          eventDate: null,
          eventTime: '19:00',
          guestCount: 100,
          status: 'NOVA',
          createdAt: new Date('2026-09-22T12:00:00.000Z')
        })))
      }
    };
    const repository = new PrismaQuoteRequestRepository(prisma as never);

    await expect(repository.delete('quote-1')).resolves.toBe(true);
    await expect(repository.listLatest(5)).resolves.toEqual([]);
    expect(database.quoteRequests).toEqual([]);
    expect(database.menuSelections).toEqual([]);
    expect(database.customers).toEqual(['customer-1']);
    expect(database.events).toEqual([{ id: 'event-1', quoteRequestId: null }]);
    expect(database.proposals).toEqual([{ id: 'proposal-1', quoteRequestId: null }]);
  });
});
