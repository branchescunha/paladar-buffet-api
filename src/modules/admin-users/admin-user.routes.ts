import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { notFoundError } from '../../shared/errors.js';
import { csrfProtection, requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { adminProfileSchema, adminUserActiveSchema, adminUserIdSchema } from './admin-user.schemas.js';
import type { AdminUserManagementService } from './admin-user.service.js';

export function adminUserRoutes(authService: AuthService, service: AdminUserManagementService) {
  const router = Router();

  router.get('/', requireAuth(authService), requireAdmin, asyncHandler(async (_request, response) => {
    response.json(await service.list());
  }));
  router.patch('/profile', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const item = await service.updateOwnProfile(request.admin!.id, adminProfileSchema.parse(request.body));
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.patch('/:id/active', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const item = await service.setActive(
      adminUserIdSchema.parse(request.params).id,
      adminUserActiveSchema.parse(request.body).isActive,
      request.admin!.id
    );
    if (!item) throw notFoundError();
    response.json(item);
  }));

  return router;
}
