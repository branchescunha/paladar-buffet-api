import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';
import { requestId } from './middlewares/request-id.js';
import { adminDashboardRoutes } from './modules/admin-dashboard/admin-dashboard.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { makeAuthService } from './modules/auth/auth.factory.js';
import type { AuthService } from './modules/auth/auth.service.js';
import { makeCustomerService, makeEventService, makeQuoteConversionService } from './modules/crm/crm.factory.js';
import { customerRoutes, eventRoutes } from './modules/crm/crm.routes.js';
import type { CustomerService, EventService, QuoteConversionService } from './modules/crm/crm.service.js';
import { makeQuoteRequestService } from './modules/quote-requests/quote-request.factory.js';
import { adminQuoteRequestRoutes } from './modules/quote-requests/admin-quote-request.routes.js';
import { quoteRequestRoutes } from './modules/quote-requests/quote-request.routes.js';
import type { QuoteRequestService } from './modules/quote-requests/quote-request.service.js';
import { makeProposalService } from './modules/proposals/proposal.factory.js';
import { proposalRoutes, quoteProposalRoutes } from './modules/proposals/proposal.routes.js';
import type { ProposalService } from './modules/proposals/proposal.service.js';
import { makeProposalPdfService } from './modules/proposals/proposal-pdf.factory.js';
import type { ProposalPdfService } from './modules/proposals/proposal-pdf.service.js';
import { makeAdminUserManagementService } from './modules/admin-users/admin-user.factory.js';
import { adminUserRoutes } from './modules/admin-users/admin-user.routes.js';
import type { AdminUserManagementService } from './modules/admin-users/admin-user.service.js';

interface AppOptions {
  authService?: AuthService;
  quoteRequestService?: QuoteRequestService;
  customerService?: CustomerService;
  eventService?: EventService;
  conversionService?: QuoteConversionService;
  proposalService?: ProposalService;
  pdfService?: ProposalPdfService;
  adminUserService?: AdminUserManagementService;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const authService = options.authService ?? makeAuthService();
  const quoteRequestService = options.quoteRequestService ?? makeQuoteRequestService();
  const customerService = options.customerService ?? makeCustomerService();
  const eventService = options.eventService ?? makeEventService();
  const conversionService = options.conversionService ?? makeQuoteConversionService();
  const proposalService = options.proposalService ?? makeProposalService();
  const pdfService = options.pdfService ?? makeProposalPdfService();
  const adminUserService = options.adminUserService ?? makeAdminUserManagementService();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(
    pinoHttp({
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]'
      ]
    })
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'paladar-buffet-api',
      environment: env.NODE_ENV
    });
  });

  app.use('/auth', authRoutes(authService));
  app.use('/quote-requests', quoteRequestRoutes(quoteRequestService));
  app.use('/admin/dashboard', adminDashboardRoutes(authService, quoteRequestService, eventService, proposalService));
  app.use('/admin/quote-requests', adminQuoteRequestRoutes(authService, quoteRequestService, conversionService));
  app.use('/admin/customers', customerRoutes(authService, customerService));
  app.use('/admin/events', eventRoutes(authService, eventService));
  app.use('/admin/users', adminUserRoutes(authService, adminUserService));
  app.use('/admin/proposals', proposalRoutes(authService, proposalService, pdfService));
  app.use('/admin/quote-requests', quoteProposalRoutes(authService, proposalService));
  app.use(errorHandler);

  return app;
}
