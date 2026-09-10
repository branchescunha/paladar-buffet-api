import { prisma } from '../../lib/prisma.js';
import { PrismaCustomerService, PrismaEventService, PrismaQuoteConversionService } from './prisma-crm.service.js';
export const makeCustomerService = () => new PrismaCustomerService(prisma);
export const makeEventService = () => new PrismaEventService(prisma);
export const makeQuoteConversionService = () => new PrismaQuoteConversionService(prisma);
