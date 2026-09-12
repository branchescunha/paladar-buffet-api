import { Prisma } from '@prisma/client';
import { ApiError, resourceConflictError } from '../../shared/errors.js';
import type { ProposalInput, ProposalStatus } from './proposal.schemas.js';
import type { ProposalService } from './proposal.service.js';

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

  findById(id: string) {
    return this.prisma.proposal.findUnique({
      where: { id },
      include: { customer: true, event: true, quoteRequest: { select: { id: true, fullName: true, status: true } }, items: { orderBy: { position: 'asc' } } }
    });
  }

  create(input: ProposalInput) {
    return this.prisma.$transaction(async (tx) => {
      await assertRelationships(tx, input);
      const totals = calculateTotals(input);
      return tx.proposal.create({ data: { ...proposalData(input, totals), items: { create: itemsData(input, totals.itemSubtotals) } }, include: proposalDetailInclude });
    });
  }

  async update(id: string, input: ProposalInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.proposal.findUnique({ where: { id } });
      if (!existing) return null;
      await assertRelationships(tx, input);
      const totals = calculateTotals(input);
      return tx.proposal.update({
        where: { id }, data: { ...proposalData(input, totals), items: { deleteMany: {}, create: itemsData(input, totals.itemSubtotals) } }, include: proposalDetailInclude
      });
    });
  }

  async updateStatus(id: string, status: ProposalStatus) {
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({ where: { id }, select: { id: true, quoteRequestId: true } });
      if (!proposal) return null;
      const result = await tx.proposal.update({ where: { id }, data: { status }, include: proposalDetailInclude });
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

  async createDraftFromQuote(quoteRequestId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const quote = await tx.quoteRequest.findUnique({ where: { id: quoteRequestId }, include: { event: true } });
        if (!quote?.customerId || !quote.event || quote.event.customerId !== quote.customerId) return null;
        const existing = await tx.proposal.findFirst({ where: { quoteRequestId, status: 'RASCUNHO' }, include: proposalDetailInclude });
        if (existing) return existing;
        return tx.proposal.create({
          data: { customerId: quote.customerId, eventId: quote.event.id, quoteRequestId, validUntil: new Date(Date.now() + 14 * 86400000), items: { create: [{ description: quote.eventTypeOther ?? quote.eventType, quantity: 1, unitPriceCents: 0, subtotalCents: 0, position: 0 }] } },
          include: proposalDetailInclude
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.proposal.findFirst({ where: { quoteRequestId, status: 'RASCUNHO' }, include: proposalDetailInclude });
      }
      throw error;
    }
  }

  countSent() { return this.prisma.proposal.count({ where: { status: 'ENVIADA' } }); }
}

const proposalDetailInclude = { customer: true, event: true, quoteRequest: { select: { id: true, fullName: true, status: true } }, items: { orderBy: { position: 'asc' } } } as const;

function calculateTotals(input: ProposalInput) {
  const itemSubtotals = input.items.map((item) => {
    const subtotal = item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647) throw validationError('Valor da proposta excede o limite permitido.');
    return subtotal;
  });
  const subtotalCents = itemSubtotals.reduce((total, value) => total + value, 0);
  const totalCents = subtotalCents + input.adjustmentCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 2147483647) throw validationError('Total da proposta invÃ¡lido.');
  return { itemSubtotals, subtotalCents, totalCents };
}

function proposalData(input: ProposalInput, totals: { subtotalCents: number; totalCents: number }) {
  return { customerId: input.customerId, eventId: input.eventId, quoteRequestId: input.quoteRequestId, description: input.description, notes: input.notes, validUntil: input.validUntil, subtotalCents: totals.subtotalCents, adjustmentCents: input.adjustmentCents, totalCents: totals.totalCents };
}
function itemsData(input: ProposalInput, subtotals: number[]) { return input.items.map((item, position) => ({ ...item, subtotalCents: subtotals[position], position })); }

async function assertRelationships(tx: import('@prisma/client').Prisma.TransactionClient, input: ProposalInput) {
  const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw validationError('Cliente invÃ¡lido.');
  if (input.eventId) {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event || event.customerId !== input.customerId) throw validationError('O evento deve pertencer ao cliente selecionado.');
  }
  if (input.quoteRequestId) {
    const quote = await tx.quoteRequest.findUnique({ where: { id: input.quoteRequestId }, include: { event: true } });
    if (!quote || quote.customerId !== input.customerId || (input.eventId && quote.event?.id !== input.eventId)) throw validationError('A solicitaÃ§Ã£o deve ser compatÃ­vel com o cliente e o evento selecionados.');
    if (input.eventId && quote.event?.customerId !== input.customerId) throw validationError('A solicitaÃ§Ã£o possui um evento incompatÃ­vel.');
  }
}
