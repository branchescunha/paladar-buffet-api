import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { notFoundError } from '../../shared/errors.js';
import { csrfProtection, requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { proposalIdSchema, proposalInputSchema, proposalListSchema, proposalStatusUpdateSchema } from './proposal.schemas.js';
import type { ProposalService } from './proposal.service.js';
import type { ProposalPdfService } from './proposal-pdf.service.js';

export function proposalRoutes(authService: AuthService, service: ProposalService, pdfService: ProposalPdfService) {
  const router = Router();
  router.get('/', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => response.json(await service.list(proposalListSchema.parse(request.query)))));
  router.post('/', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const input = proposalInputSchema.parse(request.body);
    delete input.subtotalCents;
    delete input.totalCents;
    response.status(201).json(await service.create(input, request.admin!.id));
  }));
  router.get('/:id', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => { const item = await service.findById(proposalIdSchema.parse(request.params).id); if (!item) throw notFoundError(); response.json(item); }));
  router.get('/:id/pdf', requireAuth(authService), requireAdmin, asyncHandler(async (request, response) => {
    const document = await pdfService.generate(proposalIdSchema.parse(request.params).id);
    if (!document) throw notFoundError();
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="proposta-comercial-paladar.pdf"');
    response.send(document);
  }));
  router.patch('/:id', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const input = proposalInputSchema.parse(request.body);
    delete input.subtotalCents;
    delete input.totalCents;
    const item = await service.update(proposalIdSchema.parse(request.params).id, input);
    if (!item) throw notFoundError();
    response.json(item);
  }));
  router.patch('/:id/status', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => { const item = await service.updateStatus(proposalIdSchema.parse(request.params).id, proposalStatusUpdateSchema.parse(request.body).status); if (!item) throw notFoundError(); response.json(item); }));
  router.delete('/:id', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => {
    const deleted = await service.delete(proposalIdSchema.parse(request.params).id);
    if (!deleted) throw notFoundError();
    response.status(204).send();
  }));
  return router;
}

export function quoteProposalRoutes(authService: AuthService, service: ProposalService) {
  const router = Router();
  router.post('/:id/proposal-draft', requireAuth(authService), requireAdmin, csrfProtection(authService), asyncHandler(async (request, response) => { const item = await service.createDraftFromQuote(proposalIdSchema.parse(request.params).id, request.admin!.id); if (!item) throw notFoundError(); response.status(201).json(item); }));
  return router;
}
