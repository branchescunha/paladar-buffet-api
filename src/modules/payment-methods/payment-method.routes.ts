import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { notFoundError } from '../../shared/errors.js';
import { csrfProtection, requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { paymentMethodIdSchema, paymentMethodInputSchema } from './payment-method.schemas.js';
import type { PaymentMethodService } from './payment-method.service.js';

export function paymentMethodRoutes(authService: AuthService, service: PaymentMethodService) {
  const router = Router();
  const admin = [requireAuth(authService), requireAdmin] as const;
  const mutation = [requireAuth(authService), requireAdmin, csrfProtection(authService)] as const;

  router.get('/', ...admin, asyncHandler(async (_request, response) => response.json(await service.list())));
  router.post('/', ...mutation, asyncHandler(async (request, response) => response.status(201).json(await service.create(paymentMethodInputSchema.parse(request.body)))));
  router.patch('/:id', ...mutation, asyncHandler(async (request, response) => {
    const item = await service.update(paymentMethodIdSchema.parse(request.params).id, paymentMethodInputSchema.parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.delete('/:id', ...mutation, asyncHandler(async (request, response) => {
    if (!await service.delete(paymentMethodIdSchema.parse(request.params).id)) throw notFoundError();
    response.status(204).send();
  }));

  return router;
}
