import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { requireAdmin, requireAuth } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { QuoteRequestService } from '../quote-requests/quote-request.service.js';
import type { EventService } from '../crm/crm.service.js';
import type { ProposalService } from '../proposals/proposal.service.js';

export function adminDashboardRoutes(authService: AuthService, quoteRequestService: QuoteRequestService, eventService: EventService, proposalService: ProposalService) {
  const router = Router();

  router.get(
    '/',
    requireAuth(authService),
    requireAdmin,
    asyncHandler(async (_request, response) => {
      const [latestRequests, dashboardMetrics, approvedEvents, proposalsSent] = await Promise.all([
        quoteRequestService.listLatest(),
        quoteRequestService.getDashboardMetrics(),
        eventService.countConfirmed(),
        proposalService.countSent()
      ]);

      response.json({
        metrics: {
          newRequests: dashboardMetrics.newRequests,
          inProgress: dashboardMetrics.inProgress,
          proposalsSent,
          approvedEvents
        },
        latestRequests
      });
    })
  );

  return router;
}
