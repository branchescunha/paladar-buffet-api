import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { clearAuthCookies, sessionCookieName, setAuthCookies } from './auth.cookies.js';
import { forgotPasswordSchema, googleLoginSchema, loginSchema, resetPasswordSchema } from './auth.schemas.js';
import { csrfProtection, requireAdmin, requireAuth } from './auth.middleware.js';
import type { AuthService } from './auth.service.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

export function authRoutes(authService: AuthService) {
  const router = Router();

  router.post(
    '/login',
    authLimiter,
    asyncHandler(async (request, response) => {
      const body = loginSchema.parse(request.body);
      const result = await authService.login({
        ...body,
        ipAddress: request.ip,
        userAgent: request.header('user-agent')
      });
      setAuthCookies(response, env, result.sessionToken, result.csrfToken);
      response.json({ admin: result.admin });
    })
  );

  router.post(
    '/google',
    authLimiter,
    asyncHandler(async (request, response) => {
      const body = googleLoginSchema.parse(request.body);
      const result = await authService.googleLogin({
        ...body,
        ipAddress: request.ip,
        userAgent: request.header('user-agent')
      });
      setAuthCookies(response, env, result.sessionToken, result.csrfToken);
      response.json({ admin: result.admin });
    })
  );

  router.get(
    '/me',
    asyncHandler(async (request, response) => {
      const { admin } = await authService.currentSession(request.cookies[sessionCookieName]);
      response.json({ admin });
    })
  );

  router.post(
    '/logout',
    csrfProtection,
    asyncHandler(async (request, response) => {
      await authService.logout(request.cookies[sessionCookieName], {
        ipAddress: request.ip,
        userAgent: request.header('user-agent')
      });
      clearAuthCookies(response, env);
      response.status(204).send();
    })
  );

  router.post(
    '/forgot-password',
    authLimiter,
    asyncHandler(async (request, response) => {
      const body = forgotPasswordSchema.parse(request.body);
      await authService.requestPasswordReset({
        ...body,
        ipAddress: request.ip,
        userAgent: request.header('user-agent')
      });
      response.json({
        message: 'Se o e-mail estiver autorizado, enviaremos as instrucoes de recuperacao.'
      });
    })
  );

  router.post(
    '/reset-password',
    authLimiter,
    asyncHandler(async (request, response) => {
      const body = resetPasswordSchema.parse(request.body);
      await authService.resetPassword({
        ...body,
        ipAddress: request.ip,
        userAgent: request.header('user-agent')
      });
      response.json({ message: 'Senha redefinida com sucesso.' });
    })
  );

  router.get('/admin/session-check', requireAuth(authService), requireAdmin, (_request, response) => {
    response.json({ ok: true });
  });

  return router;
}
