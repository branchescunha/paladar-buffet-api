import { Router } from 'express';
import { notFoundError } from '../../shared/errors.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { csrfProtection, requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { quoteConversionSchema } from '../crm/crm.schemas.js';
import type { QuoteConversionService } from '../crm/crm.service.js';
import {
  adminQuoteRequestListSchema,
  adminQuoteRequestParamsSchema,
  updateQuoteRequestStatusSchema
} from './admin-quote-request.schemas.js';
import type { QuoteRequestService } from './quote-request.service.js';

export function adminQuoteRequestRoutes(
  authService: AuthService,
  quoteRequestService: QuoteRequestService,
  conversionService: QuoteConversionService
) {
  const router = Router();

  router.get(
    '/',
    requireAuth(authService),
    requireAdmin,
    asyncHandler(async (request, response) => {
      const input = adminQuoteRequestListSchema.parse(request.query);
      response.json(await quoteRequestService.listAdmin(input));
    })
  );

  router.get(
    '/:id',
    requireAuth(authService),
    requireAdmin,
    asyncHandler(async (request, response) => {
      const { id } = adminQuoteRequestParamsSchema.parse(request.params);
      const quoteRequest = await quoteRequestService.findAdminById(id);

      if (!quoteRequest) {
        throw notFoundError();
      }

      response.json(quoteRequest);
    })
  );

  router.patch(
    '/:id/status',
    requireAuth(authService),
    requireAdmin,
    csrfProtection(authService),
    asyncHandler(async (request, response) => {
      const { id } = adminQuoteRequestParamsSchema.parse(request.params);
      const { status } = updateQuoteRequestStatusSchema.parse(request.body);
      const result = await quoteRequestService.updateStatus(id, status);

      if (!result) {
        throw notFoundError();
      }

      response.json(result);
    })
  );

  router.delete(
    '/:id',
    requireAuth(authService),
    requireAdmin,
    csrfProtection(authService),
    asyncHandler(async (request, response) => {
      const { id } = adminQuoteRequestParamsSchema.parse(request.params);
      const deleted = await quoteRequestService.delete(id);

      if (!deleted) {
        throw notFoundError();
      }

      response.status(204).send();
    })
  );

  router.post(
    '/:id/convert',
    requireAuth(authService),
    requireAdmin,
    csrfProtection(authService),
    asyncHandler(async (request, response) => {
      const { id } = adminQuoteRequestParamsSchema.parse(request.params);
      const result = await conversionService.convert(id, quoteConversionSchema.parse(request.body));

      if (!result) {
        throw notFoundError();
      }

      response.status(201).json(result);
    })
  );

  return router;
}
