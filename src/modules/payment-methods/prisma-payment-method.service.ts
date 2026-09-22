import { Prisma, type PrismaClient } from '@prisma/client';
import { resourceConflictError } from '../../shared/errors.js';
import type { PaymentMethodInput } from './payment-method.schemas.js';
import type { PaymentMethodService } from './payment-method.service.js';

export class PrismaPaymentMethodService implements PaymentMethodService {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.paymentMethod.findMany({ orderBy: { position: 'asc' } });
  }

  create(input: PaymentMethodInput) {
    return this.prisma.paymentMethod.create({ data: input });
  }

  async update(id: string, input: PaymentMethodInput) {
    const result = await this.prisma.paymentMethod.updateMany({ where: { id }, data: input });
    return result.count ? this.prisma.paymentMethod.findUnique({ where: { id } }) : null;
  }

  async delete(id: string) {
    try {
      const existing = await this.prisma.paymentMethod.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return false;
      await this.prisma.paymentMethod.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return false;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw resourceConflictError('Esta forma de pagamento está em uso e deve ser desativada.');
      }
      throw error;
    }
  }
}
