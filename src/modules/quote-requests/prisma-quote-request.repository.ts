import { Prisma, type PrismaClient } from '@prisma/client';
import type { QuoteRequestInput } from './quote-request.schemas.js';
import type { QuoteRequestRepository } from './quote-request.service.js';

export class PrismaQuoteRequestRepository implements QuoteRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: Omit<QuoteRequestInput, 'website'>) {
    return this.prisma.quoteRequest.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        eventType: input.eventType,
        eventTypeOther: input.eventTypeOther,
        eventDate: input.eventDate,
        guestCount: input.guestCount,
        location: input.location,
        message: input.message,
        preferredContact: input.preferredContact,
        menuPreferences: toJson(input.menuPreferences),
        serviceNeeds: toJson(input.serviceNeeds),
        dietaryRestrictions: input.dietaryRestrictions,
        acceptedPrivacy: input.acceptedPrivacy
      },
      select: {
        id: true,
        createdAt: true
      }
    });
  }
}

function toJson(value: string[] | undefined) {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}
