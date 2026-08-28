import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';
import { requestId } from './middlewares/request-id.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { makeAuthService } from './modules/auth/auth.factory.js';
import { makeQuoteRequestService } from './modules/quote-requests/quote-request.factory.js';
import { quoteRequestRoutes } from './modules/quote-requests/quote-request.routes.js';
import type { QuoteRequestService } from './modules/quote-requests/quote-request.service.js';

interface AppOptions {
  quoteRequestService?: QuoteRequestService;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

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

  app.use('/auth', authRoutes(makeAuthService()));
  app.use('/quote-requests', quoteRequestRoutes(options.quoteRequestService ?? makeQuoteRequestService()));
  app.use(errorHandler);

  return app;
}
