import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaProposalService } from '../../src/modules/proposals/prisma-proposal.service.js';
import { proposalInputSchema } from '../../src/modules/proposals/proposal.schemas.js';

const databaseUrl = process.env.PROPOSAL_INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))('proposal flow with PostgreSQL', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const service = new PrismaProposalService(prisma);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ids = {
    admin: `admin-${suffix}`,
    customer: `customer-${suffix}`,
    quote: `quote-${suffix}`,
    event: `event-${suffix}`,
    payment: `payment-${suffix}`
  };

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.adminUser.create({ data: {
      id: ids.admin, name: 'Administrador Teste', commercialTitle: 'Gerente comercial',
      email: `${ids.admin}@example.test`, role: 'ADMIN', mustChangePassword: false
    } });
    await prisma.customer.create({ data: {
      id: ids.customer, name: 'Cliente Teste', phone: '61999999999', email: `${ids.customer}@example.test`
    } });
    await prisma.quoteRequest.create({ data: {
      id: ids.quote, fullName: 'Cliente Teste', phone: '61999999999', eventType: 'casamento',
      eventTime: '19:30', guestCount: 80, preferredContact: 'whatsapp', acceptedPrivacy: true,
      customerId: ids.customer,
      menuSelections: { create: [
        { groupName: 'Entradas', groupPosition: 1, sectionName: 'Entradas frias', sectionPosition: 1, optionName: 'Barquete de guacamole', optionPosition: 1 },
        { groupName: 'Acompanhamentos', groupPosition: 2, sectionName: 'Massas', sectionPosition: 2, optionName: 'Penne ao molho quatro queijos', optionPosition: 1 }
      ] }
    } });
    await prisma.event.create({ data: {
      id: ids.event, customerId: ids.customer, quoteRequestId: ids.quote, eventType: 'Casamento',
      eventDate: new Date('2099-10-01T12:00:00.000Z'), eventTime: '19:30', location: 'Brasília', guestCount: 80
    } });
    await prisma.paymentMethod.create({ data: {
      id: ids.payment, name: `Pix ${suffix}`, position: 1, isActive: true
    } });
  });

  afterAll(async () => {
    await prisma.proposal.deleteMany({ where: { quoteRequestId: ids.quote } });
    await prisma.event.deleteMany({ where: { id: ids.event } });
    await prisma.quoteRequest.deleteMany({ where: { id: ids.quote } });
    await prisma.customer.deleteMany({ where: { id: ids.customer } });
    await prisma.paymentMethod.deleteMany({ where: { id: ids.payment } });
    await prisma.adminUser.deleteMany({ where: { id: ids.admin } });
    await prisma.$disconnect();
  });

  it('creates, saves and reopens a quote draft with ordered immutable menu snapshots', async () => {
    const draft = await service.createDraftFromQuote(ids.quote, ids.admin) as { id: string; menuSelections: Array<{ optionName: string }> };
    expect(draft.menuSelections.map((selection) => selection.optionName)).toEqual([
      'Barquete de guacamole', 'Penne ao molho quatro queijos'
    ]);

    await service.update(draft.id, proposalInputSchema.parse({
      customerId: ids.customer,
      eventId: ids.event,
      quoteRequestId: ids.quote,
      validUntil: '2099-10-15',
      pricingMode: 'PER_GUEST',
      guestCount: 80,
      pricePerGuestCents: 12990,
      adjustmentCents: 0,
      includedServices: ['Buffet'],
      paymentMethodIds: [ids.payment]
    }));

    const reopened = await service.findById(draft.id) as { menuSelections: Array<{ groupName: string; sectionName: string; optionName: string }> };
    expect(reopened.menuSelections).toEqual([
      expect.objectContaining({ groupName: 'Entradas', sectionName: 'Entradas frias', optionName: 'Barquete de guacamole' }),
      expect.objectContaining({ groupName: 'Acompanhamentos', sectionName: 'Massas', optionName: 'Penne ao molho quatro queijos' })
    ]);
  });
});
