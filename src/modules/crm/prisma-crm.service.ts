import { Prisma } from '@prisma/client';
import { ApiError, resourceConflictError } from '../../shared/errors.js';
import type { CustomerInput, EventInput, EventStatus, EventUpdate } from './crm.schemas.js';
import type { CustomerService, EventService, QuoteConversionService } from './crm.service.js';

export class PrismaCustomerService implements CustomerService {
  constructor(private readonly prisma: import('@prisma/client').PrismaClient) {}
  list(search?: string) {
    return this.prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } }
            ]
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }
  create(input: CustomerInput) {
    return this.prisma.customer.create({ data: { ...input, email: input.email?.toLowerCase() } });
  }
  findById(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        events: { orderBy: { eventDate: 'desc' } },
        quoteRequests: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });
  }
  async update(id: string, input: Partial<CustomerInput>) {
    const result = await this.prisma.customer.updateMany({
      where: { id },
      data: { ...input, email: input.email?.toLowerCase() }
    });
    return result.count ? this.findById(id) : null;
  }

  async delete(id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id },
          select: { id: true, _count: { select: { events: true, proposals: true } } }
        });
        if (!customer) return false;
        if (customer._count.events || customer._count.proposals) throw customerDependencyError();
        await tx.customer.delete({ where: { id } });
        return true;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) return false;
      if (isPrismaError(error, 'P2003')) throw customerDependencyError();
      throw error;
    }
  }
}

export class PrismaEventService implements EventService {
  constructor(private readonly prisma: import('@prisma/client').PrismaClient) {}
  list(input: { search?: string; status?: EventStatus }) {
    return this.prisma.event.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { eventType: { contains: input.search, mode: 'insensitive' } },
                { customer: { name: { contains: input.search, mode: 'insensitive' } } }
              ]
            }
          : {})
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { eventDate: 'asc' },
      take: 50
    });
  }
  create(input: EventInput) {
    return this.prisma.event.create({
      data: input,
      include: { customer: { select: { id: true, name: true } } }
    });
  }
  findById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        customer: true,
        quoteRequest: { select: { id: true, fullName: true, status: true } }
      }
    });
  }
  async update(id: string, input: EventUpdate) {
    const result = await this.prisma.event.updateMany({ where: { id }, data: input });
    return result.count ? this.findById(id) : null;
  }
  async delete(id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({
          where: { id },
          select: { id: true, _count: { select: { proposals: true } } }
        });
        if (!event) return false;
        if (event._count.proposals) throw eventDependencyError();
        await tx.event.delete({ where: { id } });
        return true;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) return false;
      if (isPrismaError(error, 'P2003')) throw eventDependencyError();
      throw error;
    }
  }
  countConfirmed() {
    return this.prisma.event.count({ where: { status: 'CONFIRMADO' } });
  }
}

const customerDependencyError = () => resourceConflictError('Este cliente possui eventos ou propostas vinculados e não pode ser excluído.');
const eventDependencyError = () => resourceConflictError('Este evento possui proposta vinculada e não pode ser excluído.');
const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export class PrismaQuoteConversionService implements QuoteConversionService {
  constructor(private readonly prisma: import('@prisma/client').PrismaClient) {}
  async convert(id: string, input: { customerId?: string; customerNotes?: string; eventNotes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quoteRequest.findUnique({ where: { id }, include: { event: true } });
      if (!quote) return null;
      if (!quote.eventDate || !quote.eventTime || !quote.location) {
        throw new ApiError(400, 'A solicita\u00e7\u00e3o n\u00e3o possui dados suficientes para criar um evento.', 'VALIDATION_ERROR');
      }
      const customer = input.customerId
        ? await tx.customer.findUnique({ where: { id: input.customerId } })
        : quote.customerId
          ? await tx.customer.findUnique({ where: { id: quote.customerId } })
          : quote.email
            ? await tx.customer.findFirst({ where: { email: quote.email.toLowerCase(), phone: quote.phone } })
            : null;
      if (input.customerId && !customer) return null;

      const resolvedCustomer =
        customer ??
        (await tx.customer.create({
          data: {
            name: quote.fullName,
            phone: quote.phone,
            email: quote.email?.toLowerCase(),
            notes: input.customerNotes
          }
        }));
      await tx.quoteRequest.update({ where: { id }, data: { customerId: resolvedCustomer.id } });
      const event = quote.event ?? await tx.event.create({ data: { customerId: resolvedCustomer.id, quoteRequestId: quote.id, eventType: quote.eventTypeOther ?? quote.eventType, eventDate: quote.eventDate, eventTime: quote.eventTime, location: quote.location, guestCount: quote.guestCount, notes: input.eventNotes } });
      return { customerId: resolvedCustomer.id, eventId: event.id, quoteRequestStatus: quote.status };
    });
  }
}
