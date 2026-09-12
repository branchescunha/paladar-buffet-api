import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { PrismaCustomerService, PrismaEventService } from '../../src/modules/crm/prisma-crm.service.js';
import { PrismaProposalService } from '../../src/modules/proposals/prisma-proposal.service.js';
import { ApiError } from '../../src/shared/errors.js';

interface State {
  customers: string[];
  events: Array<{ id: string; customerId: string }>;
  proposals: Array<{ id: string; customerId: string; eventId: string | null }>;
  proposalItems: Array<{ id: string; proposalId: string }>;
  quoteRequests: Array<{ id: string; customerId: string | null }>;
}

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Persistence failure', {
    code,
    clientVersion: '6.12.0'
  });
}

function createPrisma(state: State, deleteFailure?: { entity: 'customer' | 'event' | 'proposal'; code: string }) {
  const tx = {
    customer: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (!state.customers.includes(where.id)) return null;
        return {
          id: where.id,
          _count: {
            events: state.events.filter((event) => event.customerId === where.id).length,
            proposals: state.proposals.filter((proposal) => proposal.customerId === where.id).length
          }
        };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        if (deleteFailure?.entity === 'customer') throw knownError(deleteFailure.code);
        state.customers = state.customers.filter((id) => id !== where.id);
        state.quoteRequests = state.quoteRequests.map((quote) => quote.customerId === where.id ? { ...quote, customerId: null } : quote);
        return { id: where.id };
      }
    },
    event: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const event = state.events.find((item) => item.id === where.id);
        if (!event) return null;
        return {
          ...event,
          _count: { proposals: state.proposals.filter((proposal) => proposal.eventId === where.id).length }
        };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        if (deleteFailure?.entity === 'event') throw knownError(deleteFailure.code);
        state.events = state.events.filter((event) => event.id !== where.id);
        return { id: where.id };
      }
    },
    proposal: {
      findUnique: async ({ where }: { where: { id: string } }) => state.proposals.find((proposal) => proposal.id === where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        if (deleteFailure?.entity === 'proposal') throw knownError(deleteFailure.code);
        state.proposals = state.proposals.filter((proposal) => proposal.id !== where.id);
        state.proposalItems = state.proposalItems.filter((item) => item.proposalId !== where.id);
        return { id: where.id };
      }
    }
  };

  return { $transaction: async <T>(operation: (client: typeof tx) => Promise<T>) => operation(tx) };
}

function state(): State {
  return {
    customers: ['customer-1', 'customer-2'],
    events: [{ id: 'event-1', customerId: 'customer-1' }],
    proposals: [{ id: 'proposal-1', customerId: 'customer-1', eventId: 'event-1' }],
    proposalItems: [{ id: 'item-1', proposalId: 'proposal-1' }, { id: 'item-2', proposalId: 'proposal-1' }],
    quoteRequests: [{ id: 'quote-1', customerId: 'customer-2' }]
  };
}

async function expectConflict(operation: Promise<unknown>, message: string) {
  const error = await operation.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ statusCode: 409, code: 'RESOURCE_CONFLICT', message });
}

describe('safe administrative deletion', () => {
  it('deletes only a proposal and its composed items', async () => {
    const database = state();
    const service = new PrismaProposalService(createPrisma(database) as never);

    expect(await service.delete('proposal-1')).toBe(true);
    expect(database.proposals).toEqual([]);
    expect(database.proposalItems).toEqual([]);
    expect(database.customers).toEqual(['customer-1', 'customer-2']);
    expect(database.events).toEqual([{ id: 'event-1', customerId: 'customer-1' }]);
  });

  it('returns not found when the proposal does not exist or disappears concurrently', async () => {
    expect(await new PrismaProposalService(createPrisma(state()) as never).delete('missing')).toBe(false);
    expect(await new PrismaProposalService(createPrisma(state(), { entity: 'proposal', code: 'P2025' }) as never).delete('proposal-1')).toBe(false);
  });

  it('deletes a customer without dependencies and preserves its historical quote request', async () => {
    const database = state();
    const service = new PrismaCustomerService(createPrisma(database) as never);

    expect(await service.delete('customer-2')).toBe(true);
    expect(database.customers).toEqual(['customer-1']);
    expect(database.quoteRequests).toEqual([{ id: 'quote-1', customerId: null }]);
  });

  it('blocks customer deletion when an event exists and preserves every dependency', async () => {
    const database = state();
    const service = new PrismaCustomerService(createPrisma(database) as never);

    await expectConflict(service.delete('customer-1'), 'Este cliente possui eventos ou propostas vinculados e n\u00e3o pode ser exclu\u00eddo.');
    expect(database.customers).toContain('customer-1');
    expect(database.events).toHaveLength(1);
    expect(database.proposals).toHaveLength(1);
  });

  it('blocks customer deletion when a direct proposal exists', async () => {
    const database = state();
    database.events = [];
    database.proposals[0] = { ...database.proposals[0], eventId: null };
    const service = new PrismaCustomerService(createPrisma(database) as never);

    await expectConflict(service.delete('customer-1'), 'Este cliente possui eventos ou propostas vinculados e n\u00e3o pode ser exclu\u00eddo.');
    expect(database.proposals).toHaveLength(1);
  });

  it('maps a concurrent customer foreign-key failure to a business conflict', async () => {
    const database = state();
    database.events = [];
    database.proposals = [];
    const service = new PrismaCustomerService(createPrisma(database, { entity: 'customer', code: 'P2003' }) as never);

    await expectConflict(service.delete('customer-1'), 'Este cliente possui eventos ou propostas vinculados e n\u00e3o pode ser exclu\u00eddo.');
  });

  it('deletes only an event without proposals and preserves its customer', async () => {
    const database = state();
    database.proposals = [];
    database.proposalItems = [];
    const service = new PrismaEventService(createPrisma(database) as never);

    expect(await service.delete('event-1')).toBe(true);
    expect(database.events).toEqual([]);
    expect(database.customers).toContain('customer-1');
  });

  it('blocks event deletion when a proposal exists and preserves both proposal and customer', async () => {
    const database = state();
    const service = new PrismaEventService(createPrisma(database) as never);

    await expectConflict(service.delete('event-1'), 'Este evento possui proposta vinculada e n\u00e3o pode ser exclu\u00eddo.');
    expect(database.events).toHaveLength(1);
    expect(database.proposals).toHaveLength(1);
    expect(database.customers).toContain('customer-1');
  });

  it('maps a concurrent event foreign-key failure to a business conflict', async () => {
    const database = state();
    database.proposals = [];
    const service = new PrismaEventService(createPrisma(database, { entity: 'event', code: 'P2003' }) as never);

    await expectConflict(service.delete('event-1'), 'Este evento possui proposta vinculada e n\u00e3o pode ser exclu\u00eddo.');
  });

  it('returns not found for missing customers and events', async () => {
    expect(await new PrismaCustomerService(createPrisma(state()) as never).delete('missing')).toBe(false);
    expect(await new PrismaEventService(createPrisma(state()) as never).delete('missing')).toBe(false);
  });
});
