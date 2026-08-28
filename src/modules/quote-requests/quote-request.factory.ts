import { prisma } from '../../lib/prisma.js';
import { PrismaQuoteRequestRepository } from './prisma-quote-request.repository.js';
import { DefaultQuoteRequestService } from './quote-request.service.js';

export function makeQuoteRequestService() {
  return new DefaultQuoteRequestService(new PrismaQuoteRequestRepository(prisma));
}
