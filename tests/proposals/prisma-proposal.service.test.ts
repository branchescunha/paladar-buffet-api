import { describe, expect, it, vi } from 'vitest';
import { PrismaProposalService } from '../../src/modules/proposals/prisma-proposal.service.js';
import type { ProposalInput } from '../../src/modules/proposals/proposal.schemas.js';

interface StoredItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  position: number;
}

interface StoredProposal {
  id: string;
  customerId: string;
  eventId?: string;
  quoteRequestId?: string;
  description?: string;
  notes?: string;
  validUntil: Date;
  status: 'RASCUNHO';
  subtotalCents: number;
  adjustmentCents: number;
  totalCents: number;
  items: StoredItem[];
  paymentInstallments: Array<{ description: string; percentage: number; position: number; amountCents?: number }>;
}

type ItemWrite = Omit<StoredItem, 'id'>;
type ProposalFields = Omit<StoredProposal, 'id' | 'status' | 'items' | 'paymentInstallments'>;
type ProposalWrite = ProposalFields & {
  items: { create: ItemWrite[] };
  paymentInstallments: { create: Array<{ description: string; percentage: number; position: number }> };
};
type ProposalUpdate = ProposalFields & {
  items: { deleteMany: object; create: ItemWrite[] };
  paymentInstallments: { deleteMany: object; create: Array<{ description: string; percentage: number; position: number }> };
};

function createStatefulPrisma() {
  const stored = new Map<string, StoredProposal>();
  let proposalSequence = 0;
  let itemSequence = 0;
  const clone = <T>(value: T): T => structuredClone(value);
  const writeItems = (items: ItemWrite[]) =>
    items.map((item) => ({ ...item, id: `item-${++itemSequence}` }));

  const proposal = {
    create: vi.fn(async ({ data }: { data: ProposalWrite }) => {
      const { items, paymentInstallments: _paymentInstallments, ...fields } = data;
      const created: StoredProposal = {
        ...fields,
        id: `proposal-${++proposalSequence}`,
        status: 'RASCUNHO',
        items: writeItems(items.create),
        paymentInstallments: _paymentInstallments.create.map((installment) => ({ ...installment }))
      };
      stored.set(created.id, created);
      return clone(created);
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const found = stored.get(where.id);
      return found ? clone(found) : null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: ProposalUpdate }) => {
      const current = stored.get(where.id);
      if (!current) throw new Error('Proposal not found');
      const { items, paymentInstallments: _paymentInstallments, ...fields } = data;
      const updated: StoredProposal = {
        ...current,
        ...fields,
        items: writeItems(items.create),
        paymentInstallments: _paymentInstallments.create.map((installment) => ({ ...installment }))
      };
      stored.set(where.id, updated);
      return clone(updated);
    })
  };
  const transaction = {
    proposal,
    customer: { findUnique: vi.fn(async () => ({ id: 'customer-1' })) },
    event: { findUnique: vi.fn() },
    quoteRequest: { findUnique: vi.fn(), update: vi.fn() }
  };
  const prisma = {
    proposal,
    $transaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction)
  };

  return prisma;
}

describe('PrismaProposalService item persistence', () => {
  it('persists create and update item collections, totals and proposal isolation', async () => {
    const service = new PrismaProposalService(createStatefulPrisma() as never);
    const firstInput: ProposalInput = {
      customerId: 'customer-1',
      validUntil: new Date('2099-10-01T00:00:00.000Z'),
      adjustmentCents: -20000,
      items: [
        { description: 'Garcons', quantity: 6, unitPriceCents: 20000 },
        { description: 'Buffet', quantity: 165, unitPriceCents: 3000 }
      ]
    };

    const created = (await service.create(firstInput)) as StoredProposal;
    const second = (await service.create({
      customerId: 'customer-1',
      validUntil: new Date('2099-11-01T00:00:00.000Z'),
      adjustmentCents: 0,
      items: [{ description: 'Outra proposta', quantity: 1, unitPriceCents: 5000 }]
    })) as StoredProposal;
    const reopened = (await service.findById(created.id)) as StoredProposal;

    expect(reopened.items).toMatchObject([
      { description: 'Garcons', quantity: 6, unitPriceCents: 20000, subtotalCents: 120000, position: 0 },
      { description: 'Buffet', quantity: 165, unitPriceCents: 3000, subtotalCents: 495000, position: 1 }
    ]);
    expect(reopened).toMatchObject({ subtotalCents: 615000, adjustmentCents: -20000, totalCents: 595000 });

    await service.update(created.id, {
      ...firstInput,
      adjustmentCents: 5000,
      items: [
        { description: 'Garcons', quantity: 7, unitPriceCents: 21000 },
        { description: 'Bebidas', quantity: 10, unitPriceCents: 2500 }
      ]
    });

    const updated = (await service.findById(created.id)) as StoredProposal;
    expect(updated.items).toMatchObject([
      { description: 'Garcons', quantity: 7, unitPriceCents: 21000, subtotalCents: 147000, position: 0 },
      { description: 'Bebidas', quantity: 10, unitPriceCents: 2500, subtotalCents: 25000, position: 1 }
    ]);
    expect(updated.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ description: 'Buffet' })]));
    expect(updated).toMatchObject({ subtotalCents: 172000, adjustmentCents: 5000, totalCents: 177000 });
    expect(await service.findById(second.id)).toMatchObject({
      items: [{ description: 'Outra proposta', quantity: 1, unitPriceCents: 5000, subtotalCents: 5000 }],
      subtotalCents: 5000,
      totalCents: 5000
    });
  });
});
