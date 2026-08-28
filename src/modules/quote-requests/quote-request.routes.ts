import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../shared/async-handler.js';
import { quoteRequestSchema } from './quote-request.schemas.js';
import type { QuoteRequestService } from './quote-request.service.js';

const quoteRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

export function quoteRequestRoutes(quoteRequestService: QuoteRequestService) {
  const router = Router();

  router.post(
    '/',
    quoteRequestLimiter,
    asyncHandler(async (request, response) => {
      const { website, ...body } = quoteRequestSchema.parse(request.body);

      if (website) {
        response.status(201).json({ id: randomUUID(), createdAt: new Date().toISOString() });
        return;
      }

      const receipt = await quoteRequestService.create(body);
      response.status(201).json({ id: receipt.id, createdAt: receipt.createdAt.toISOString() });
    })
  );

  return router;
}
