import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { notFoundError } from '../../shared/errors.js';
import { csrfProtection, requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { menuGroupInputSchema, menuIdParamsSchema, menuOptionInputSchema, menuSectionInputSchema } from './menu.schemas.js';
import type { MenuService } from './menu.service.js';

export function publicMenuRoutes(service: MenuService) {
  const router = Router();
  router.get('/', asyncHandler(async (_request, response) => response.json(await service.getPublicCatalog())));
  return router;
}

export function adminMenuRoutes(authService: AuthService, service: MenuService) {
  const router = Router();
  const admin = [requireAuth(authService), requireAdmin] as const;
  const mutation = [requireAuth(authService), requireAdmin, csrfProtection(authService)] as const;

  router.get('/', ...admin, asyncHandler(async (_request, response) => response.json(await service.getAdminCatalog())));
  router.post('/groups', ...mutation, asyncHandler(async (request, response) => response.status(201).json(await service.createGroup(menuGroupInputSchema.parse(request.body)))));
  router.patch('/groups/:id', ...mutation, asyncHandler(async (request, response) => {
    const item = await service.updateGroup(menuIdParamsSchema.parse(request.params).id, menuGroupInputSchema.parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.delete('/groups/:id', ...mutation, asyncHandler(async (request, response) => {
    if (!await service.deleteGroup(menuIdParamsSchema.parse(request.params).id)) throw notFoundError();
    response.status(204).send();
  }));
  router.post('/sections', ...mutation, asyncHandler(async (request, response) => response.status(201).json(await service.createSection(menuSectionInputSchema.parse(request.body)))));
  router.patch('/sections/:id', ...mutation, asyncHandler(async (request, response) => {
    const item = await service.updateSection(menuIdParamsSchema.parse(request.params).id, menuSectionInputSchema.parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.delete('/sections/:id', ...mutation, asyncHandler(async (request, response) => {
    if (!await service.deleteSection(menuIdParamsSchema.parse(request.params).id)) throw notFoundError();
    response.status(204).send();
  }));
  router.post('/options', ...mutation, asyncHandler(async (request, response) => response.status(201).json(await service.createOption(menuOptionInputSchema.parse(request.body)))));
  router.patch('/options/:id', ...mutation, asyncHandler(async (request, response) => {
    const item = await service.updateOption(menuIdParamsSchema.parse(request.params).id, menuOptionInputSchema.parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.delete('/options/:id', ...mutation, asyncHandler(async (request, response) => {
    if (!await service.deleteOption(menuIdParamsSchema.parse(request.params).id)) throw notFoundError();
    response.status(204).send();
  }));

  return router;
}
