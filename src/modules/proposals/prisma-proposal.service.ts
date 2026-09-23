import { Prisma } from '@prisma/client';
import { ApiError, resourceConflictError } from '../../shared/errors.js';
import type { ProposalInput, ProposalStatus } from './proposal.schemas.js';
import type { ProposalService } from './proposal.service.js';
import {
  calculatePaymentAmounts,
  calculatePerGuestTotals,
  defaultPaymentSchedule,
  defaultProposalValidity,
  validatePaymentSchedule
} from './proposal-commercial.js';

const validationError = (message: string) => new ApiError(400, message, 'VALIDATION_ERROR');

export class PrismaProposalService implements ProposalService {
  constructor(private readonly prisma: import('@prisma/client').PrismaClient) {}

  list(input: { search?: string; status?: ProposalStatus }) {
    return this.prisma.proposal.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.search ? { OR: [{ customer: { name: { contains: input.search, mode: 'insensitive' } } }, { description: { contains: input.search, mode: 'insensitive' } }] } : {})
      },
      include: { customer: { select: { id: true, name: true } }, event: { select: { id: true, eventType: true } } },
      orderBy: { updatedAt: 'desc' }, take: 50
    });
  }

  async findById(id: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id }, include: proposalDetailInclude });
    return proposal ? addInstallmentAmounts(proposal) : null;
  }

  create(input: ProposalInput, responsibleAdminId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const { quote } = await assertRelationships(tx, input);
      const totals = calculateTotals(input);
      const schedule = input.pricingMode === 'PER_GUEST' ? input.paymentInstallments ?? defaultPaymentSchedule() : [];
      validateScheduleWhenPresent(schedule);
      const responsible = await resolveResponsible(tx, responsibleAdminId);
      const paymentMethods = input.pricingMode === 'PER_GUEST'
        ? await resolvePaymentMethods(tx, input.paymentMethodIds ?? [])
        : [];
      const proposal = await tx.proposal.create({
        data: {
          ...proposalData(input, totals, responsible),
          items: { create: itemsData(input, totals.itemSubtotals) },
          includedServices: { create: includedServicesData(input) },
          paymentInstallments: { create: paymentInstallmentsData(schedule) },
          menuSelections: { create: quote?.menuSelections ?? [] },
          paymentMethods: { create: paymentMethods }
        },
        include: proposalDetailInclude
      });
      return addInstallmentAmounts(proposal);
    });
  }

  async update(id: string, input: ProposalInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.proposal.findUnique({ where: { id }, include: { paymentMethods: true } });
      if (!existing) return null;
      await assertRelationships(tx, input);
      const totals = calculateTotals(input);
      const schedule = input.pricingMode === 'PER_GUEST' ? input.paymentInstallments ?? defaultPaymentSchedule() : [];
      validateScheduleWhenPresent(schedule);
      const paymentMethods = input.pricingMode === 'PER_GUEST'
        ? await resolvePaymentMethods(tx, input.paymentMethodIds ?? [], existing.paymentMethods)
        : [];
      const proposal = await tx.proposal.update({
        where: { id },
        data: {
          ...proposalData(input, totals),
          items: { deleteMany: {}, create: itemsData(input, totals.itemSubtotals) },
          includedServices: { deleteMany: {}, create: includedServicesData(input) },
          paymentInstallments: { deleteMany: {}, create: paymentInstallmentsData(schedule) },
          paymentMethods: { deleteMany: {}, create: paymentMethods }
        },
        include: proposalDetailInclude
      });
      return addInstallmentAmounts(proposal);
    });
  }

  async updateStatus(id: string, status: ProposalStatus) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({ where: { id }, select: { id: true, quoteRequestId: true } });
      if (!proposal) return null;
      const result = addInstallmentAmounts(await tx.proposal.update({ where: { id }, data: { status }, include: proposalDetailInclude }));
      const quoteStatus = status === 'ENVIADA' ? 'PROPOSTA_ENVIADA' : status === 'APROVADA' ? 'APROVADA' : null;
      if (proposal.quoteRequestId && quoteStatus) await tx.quoteRequest.update({ where: { id: proposal.quoteRequestId }, data: { status: quoteStatus } });
      return result;
    });
  }

  async delete(id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const proposal = await tx.proposal.findUnique({ where: { id }, select: { id: true } });
        if (!proposal) return false;
        await tx.proposal.delete({ where: { id } });
        return true;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return false;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw resourceConflictError('Esta proposta possui dependências e não pode ser excluída.');
      }
      throw error;
    }
  }

  async createDraftFromQuote(quoteRequestId: string, responsibleAdminId?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const quote = await tx.quoteRequest.findUnique({ where: { id: quoteRequestId }, include: { event: true, menuSelections: true } });
        if (!quote?.customerId || !quote.event || quote.event.customerId !== quote.customerId) return null;
        const existing = await tx.proposal.findFirst({ where: { quoteRequestId, status: 'RASCUNHO' }, include: proposalDetailInclude });
        if (existing) return addInstallmentAmounts(existing);
        const responsible = await resolveResponsible(tx, responsibleAdminId);
        const proposal = await tx.proposal.create({
          data: {
            customerId: quote.customerId,
            eventId: quote.event.id,
            quoteRequestId,
            validUntil: defaultProposalValidity(),
            pricingMode: 'PER_GUEST',
            guestCount: quote.event.guestCount,
            pricePerGuestCents: null,
            baseTotalCents: null,
            subtotalCents: 0,
            totalCents: 0,
            ...responsibleData(responsible),
            items: { create: [] },
            paymentInstallments: { create: paymentInstallmentsData(defaultPaymentSchedule()) },
            menuSelections: { create: quote.menuSelections.map(toMenuSnapshot) }
          },
          include: proposalDetailInclude
        });
        return addInstallmentAmounts(proposal);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.proposal.findFirst({ where: { quoteRequestId, status: 'RASCUNHO' }, include: proposalDetailInclude });
        return existing ? addInstallmentAmounts(existing) : null;
      }
      throw error;
    }
  }

  countSent() { return this.prisma.proposal.count({ where: { status: 'ENVIADA' } }); }
}

const proposalDetailInclude = {
  customer: true,
  event: true,
  quoteRequest: { select: { id: true, fullName: true, status: true } },
  items: { orderBy: { position: 'asc' } },
  includedServices: { orderBy: { position: 'asc' } },
  paymentInstallments: { orderBy: { position: 'asc' } },
  menuSelections: { orderBy: { groupPosition: 'asc', sectionPosition: 'asc', optionPosition: 'asc' } },
  paymentMethods: { orderBy: { position: 'asc' } },
  responsibleAdmin: { select: { id: true, name: true, role: true } }
} as const;

function calculateTotals(input: ProposalInput) {
  if (input.pricingMode === 'PER_GUEST') {
    const totals = calculatePerGuestTotals({
      guestCount: input.guestCount!,
      pricePerGuestCents: input.pricePerGuestCents!,
      adjustmentCents: input.adjustmentCents
    });
    return { itemSubtotals: [], subtotalCents: totals.baseTotalCents, baseTotalCents: totals.baseTotalCents, totalCents: totals.totalCents };
  }
  const itemSubtotals = input.items.map((item) => {
    const subtotal = item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647) throw validationError('Valor da proposta excede o limite permitido.');
    return subtotal;
  });
  const subtotalCents = itemSubtotals.reduce((total, value) => total + value, 0);
  const totalCents = subtotalCents + input.adjustmentCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 2147483647) throw validationError('Total da proposta inválido.');
  return { itemSubtotals, subtotalCents, baseTotalCents: null, totalCents };
}

type ResponsibleSnapshot = { id: string; name: string; title: string };
type PaymentSnapshot = { paymentMethodId: string; name: string; instructions: string | null; pixKey: string | null; position: number };

function proposalData(
  input: ProposalInput,
  totals: { subtotalCents: number; baseTotalCents: number | null; totalCents: number },
  responsible?: ResponsibleSnapshot
) {
  return {
    customerId: input.customerId,
    eventId: input.eventId,
    quoteRequestId: input.quoteRequestId,
    description: input.description,
    notes: input.notes,
    validUntil: input.validUntil,
    pricingMode: input.pricingMode ?? 'ITEMIZED',
    guestCount: input.pricingMode === 'PER_GUEST' ? input.guestCount : null,
    pricePerGuestCents: input.pricingMode === 'PER_GUEST' ? input.pricePerGuestCents : null,
    baseTotalCents: totals.baseTotalCents,
    subtotalCents: totals.subtotalCents,
    adjustmentCents: input.adjustmentCents,
    totalCents: totals.totalCents,
    ...responsibleData(responsible)
  };
}

function itemsData(input: ProposalInput, subtotals: number[]) { return input.items.map((item, position) => ({ ...item, subtotalCents: subtotals[position], position })); }
function includedServicesData(input: ProposalInput) { return (input.includedServices ?? []).map((description, position) => ({ description, position })); }
function paymentInstallmentsData(schedule: Array<{ description: string; percentage: number }>) { return schedule.map((item, position) => ({ ...item, position })); }
function validateScheduleWhenPresent(schedule: Array<{ description: string; percentage: number }>) { if (schedule.length) validatePaymentSchedule(schedule); }

async function assertRelationships(tx: Prisma.TransactionClient, input: ProposalInput) {
  const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw validationError('Cliente inválido.');
  if (input.eventId) {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.customerId !== input.customerId) throw validationError('O evento deve pertencer ao cliente selecionado.');
  }
  let quote = null;
  if (input.quoteRequestId) {
    quote = await tx.quoteRequest.findUnique({ where: { id: input.quoteRequestId }, include: {
      event: true,
      menuSelections: {
        orderBy: [{ groupPosition: 'asc' }, { sectionPosition: 'asc' }, { optionPosition: 'asc' }],
        select: { groupName: true, groupPosition: true, sectionName: true, sectionPosition: true, optionName: true, optionPosition: true }
      }
    } });
    if (!quote || quote.customerId !== input.customerId || (input.eventId && quote.event?.id !== input.eventId)) throw validationError('A solicitação deve ser compatível com o cliente e o evento selecionados.');
    if (input.eventId && quote.event?.customerId !== input.customerId) throw validationError('A solicitação possui um evento incompatível.');
  }
  return { quote };
}

async function resolveResponsible(tx: Prisma.TransactionClient, responsibleAdminId?: string): Promise<ResponsibleSnapshot | undefined> {
  if (!responsibleAdminId) return undefined;
  const admin = await tx.adminUser.findUnique({ where: { id: responsibleAdminId }, select: { id: true, name: true, role: true } });
  if (!admin) throw validationError('Responsável inválido.');
  return { id: admin.id, name: admin.name, title: 'Administrador' };
}

function responsibleData(responsible?: ResponsibleSnapshot) {
  return responsible ? {
    responsibleAdminId: responsible.id,
    responsibleNameSnapshot: responsible.name,
    responsibleTitleSnapshot: responsible.title
  } : {};
}

async function resolvePaymentMethods(
  tx: Prisma.TransactionClient,
  paymentMethodIds: string[],
  existing: Array<{ paymentMethodId: string; name: string; instructions: string | null; pixKey: string | null }> = []
): Promise<PaymentSnapshot[]> {
  const existingById = new Map(existing.map((method) => [method.paymentMethodId, method]));
  const missingIds = paymentMethodIds.filter((id) => !existingById.has(id));
  const activeMethods = missingIds.length ? await tx.paymentMethod.findMany({
    where: { id: { in: missingIds }, isActive: true },
    select: { id: true, name: true, instructions: true, pixKey: true }
  }) : [];
  const activeById = new Map(activeMethods.map((method) => [method.id, method]));
  if (missingIds.some((id) => !activeById.has(id))) throw validationError('Selecione apenas formas de pagamento ativas.');
  return paymentMethodIds.map((id, position) => {
    const snapshot = existingById.get(id) ?? activeById.get(id)!;
    return { paymentMethodId: id, name: snapshot.name, instructions: snapshot.instructions, pixKey: snapshot.pixKey, position };
  });
}

function toMenuSnapshot(selection: {
  groupName: string;
  groupPosition: number;
  sectionName: string;
  sectionPosition: number;
  optionName: string;
  optionPosition: number;
}) {
  return {
    groupName: selection.groupName,
    groupPosition: selection.groupPosition,
    sectionName: selection.sectionName,
    sectionPosition: selection.sectionPosition,
    optionName: selection.optionName,
    optionPosition: selection.optionPosition
  };
}

function addInstallmentAmounts<T extends {
  totalCents: number;
  paymentInstallments: Array<{ description: string; percentage: number }>;
}>(proposal: T) {
  const amounts = proposal.paymentInstallments.length
    ? calculatePaymentAmounts(proposal.totalCents, proposal.paymentInstallments)
    : [];
  return {
    ...proposal,
    paymentInstallments: proposal.paymentInstallments.map((installment, index) => ({
      ...installment,
      amountCents: amounts[index].amountCents
    }))
  };
}
