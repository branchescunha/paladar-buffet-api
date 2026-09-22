import { Prisma, type PrismaClient } from '@prisma/client';
import type { AdminQuoteRequestListInput, QuoteRequestStatus } from './admin-quote-request.schemas.js';
import type { QuoteRequestInput } from './quote-request.schemas.js';
import type { AdminQuoteRequestDetail, AdminQuoteRequestSummary, DashboardQuoteRequest, QuoteRequestRepository } from './quote-request.service.js';
import { validateMenuSelections } from '../menu/menu-selection.js';

export class PrismaQuoteRequestRepository implements QuoteRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: Omit<QuoteRequestInput, 'website'>) {
    return this.prisma.$transaction(async (transaction) => {
      const groups = await transaction.menuSelectionGroup.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        include: {
          sections: {
            where: { isActive: true },
            orderBy: { position: 'asc' },
            include: { options: { where: { isActive: true }, orderBy: { position: 'asc' } } }
          }
        }
      });
      const snapshots = validateMenuSelections(groups, input.menuOptionIds);

      return transaction.quoteRequest.create({
        data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        eventType: input.eventType,
        eventTypeOther: input.eventTypeOther,
        eventDate: input.eventDate,
        eventTime: input.eventTime,
        guestCount: input.guestCount,
        location: input.location,
        message: input.message,
        preferredContact: input.preferredContact,
        menuPreferences: toJson(input.menuPreferences),
        serviceNeeds: toJson(input.serviceNeeds),
        dietaryRestrictions: input.dietaryRestrictions,
          acceptedPrivacy: input.acceptedPrivacy,
          menuSelections: { create: snapshots }
        },
        select: {
          id: true,
          createdAt: true
        }
      });
    });
  }

  listLatest(limit: number) {
    return this.prisma.quoteRequest.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        eventType: true,
        eventTypeOther: true,
        eventDate: true,
        eventTime: true,
        guestCount: true,
        status: true,
        createdAt: true
      }
    }).then((items) => items.map(toDashboardQuoteRequest));
  }

  async getDashboardMetrics() {
    const [newRequests, inProgress] = await Promise.all([
      this.prisma.quoteRequest.count({ where: { status: 'NOVA' } }),
      this.prisma.quoteRequest.count({ where: { status: 'EM_ANALISE' } })
    ]);

    return { newRequests, inProgress };
  }

  async listAdmin(input: AdminQuoteRequestListInput) {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { fullName: { contains: input.search, mode: 'insensitive' as const } },
              { email: { contains: input.search, mode: 'insensitive' as const } },
              { phone: { contains: input.search, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quoteRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: adminSummarySelect
      }),
      this.prisma.quoteRequest.count({ where })
    ]);

    return { items: items.map(toAdminQuoteRequestSummary), total };
  }

  async findAdminById(id: string) {
    const item = await this.prisma.quoteRequest.findUnique({ where: { id }, select: adminDetailSelect });
    return item ? toAdminQuoteRequestDetail(item) : null;
  }

  async updateStatus(id: string, status: QuoteRequestStatus) {
    const result = await this.prisma.quoteRequest.updateMany({ where: { id }, data: { status } });
    return result.count ? { id, status } : null;
  }
}

const adminSummarySelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  eventType: true,
  eventTypeOther: true,
  eventDate: true,
  eventTime: true,
  guestCount: true,
  location: true,
  preferredContact: true,
  status: true,
  createdAt: true
} as const;

const adminDetailSelect = {
  ...adminSummarySelect,
  message: true,
  menuPreferences: true,
  serviceNeeds: true,
  dietaryRestrictions: true,
  acceptedPrivacy: true,
  source: true,
  updatedAt: true,
  menuSelections: {
    orderBy: [{ groupPosition: 'asc' }, { sectionPosition: 'asc' }, { optionPosition: 'asc' }],
    select: {
      groupName: true,
      groupPosition: true,
      sectionName: true,
      sectionPosition: true,
      optionName: true,
      optionPosition: true
    }
  }
} satisfies Prisma.QuoteRequestSelect;

function toDashboardQuoteRequest(item: {
  id: string;
  fullName: string;
  eventType: string;
  eventTypeOther: string | null;
  eventDate: Date | null;
  eventTime: string | null;
  guestCount: number;
  status: QuoteRequestStatus;
  createdAt: Date;
}): DashboardQuoteRequest {
  return item;
}

function toAdminQuoteRequestSummary(item: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  eventType: string;
  eventTypeOther: string | null;
  eventDate: Date | null;
  eventTime: string | null;
  guestCount: number;
  location: string | null;
  preferredContact: string;
  status: QuoteRequestStatus;
  createdAt: Date;
}): AdminQuoteRequestSummary {
  return item;
}

function toAdminQuoteRequestDetail(item: Parameters<typeof toAdminQuoteRequestSummary>[0] & {
  message: string | null;
  menuPreferences: Prisma.JsonValue | null;
  serviceNeeds: Prisma.JsonValue | null;
  dietaryRestrictions: string | null;
  acceptedPrivacy: boolean;
  source: string;
  updatedAt: Date;
  menuSelections: AdminQuoteRequestDetail['menuSelections'];
}): AdminQuoteRequestDetail {
  return {
    ...toAdminQuoteRequestSummary(item),
    message: item.message,
    menuPreferences: toStringArray(item.menuPreferences),
    serviceNeeds: toStringArray(item.serviceNeeds),
    dietaryRestrictions: item.dietaryRestrictions,
    acceptedPrivacy: item.acceptedPrivacy,
    source: item.source,
    updatedAt: item.updatedAt,
    menuSelections: item.menuSelections
  };
}

function toStringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function toJson(value: string[] | undefined) {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}
