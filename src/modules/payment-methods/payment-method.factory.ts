import { prisma } from '../../lib/prisma.js';
import { PrismaPaymentMethodService } from './prisma-payment-method.service.js';

export const makePaymentMethodService = () => new PrismaPaymentMethodService(prisma);
