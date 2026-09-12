import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { notFoundError } from '../../shared/errors.js';
import { csrfProtection, requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { customerInputSchema, customerListSchema, eventInputSchema, eventListSchema, eventUpdateSchema, idParamsSchema } from './crm.schemas.js';
import type { CustomerService, EventService } from './crm.service.js';

export function customerRoutes(authService: AuthService, service: CustomerService) {
  const router = Router();

  router.get('/', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => {
    const { search } = customerListSchema.parse(request.query);
    response.json(await service.list(search));
  }));
  router.post('/', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    response.status(201).json(await service.create(customerInputSchema.parse(request.body)));
  }));
  router.get('/:id', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => {
    const item = await service.findById(idParamsSchema.parse(request.params).id);
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.patch('/:id', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const item = await service.update(idParamsSchema.parse(request.params).id, customerInputSchema.partial().strict().parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.delete('/:id', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const deleted = await service.delete(idParamsSchema.parse(request.params).id);
    if (!deleted) throw notFoundError();
    response.status(204).send();
  }));

  return router;
}

export function eventRoutes(authService: AuthService, service: EventService) {
  const router = Router();

  router.get('/', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => {
    response.json(await service.list(eventListSchema.parse(request.query)));
  }));
  router.post('/', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    response.status(201).json(await service.create(eventInputSchema.parse(request.body)));
  }));
  router.get('/:id', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => {
    const item = await service.findById(idParamsSchema.parse(request.params).id);
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.patch('/:id', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const item = await service.update(idParamsSchema.parse(request.params).id, eventUpdateSchema.parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.delete('/:id', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const deleted = await service.delete(idParamsSchema.parse(request.params).id);
    if (!deleted) throw notFoundError();
    response.status(204).send();
  }));

  return router;
}
