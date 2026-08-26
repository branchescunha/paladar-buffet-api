import type { NextFunction, Request, Response } from 'express';
import { sha256 } from '../../shared/crypto.js';
import { forbiddenError, unauthorizedError } from '../../shared/errors.js';
import { csrfCookieName, sessionCookieName } from './auth.cookies.js';
import type { AuthService } from './auth.service.js';

const csrfProtectedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfProtection(request: Request, _response: Response, next: NextFunction) {
  if (!csrfProtectedMethods.has(request.method)) {
    next();
    return;
  }

  const csrfCookie = request.cookies[csrfCookieName];
  const csrfHeader = request.header('x-csrf-token');

  if (!csrfCookie || !csrfHeader || sha256(csrfCookie) !== sha256(csrfHeader)) {
    next(forbiddenError());
    return;
  }

  next();
}

export function requireAuth(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const { admin } = await authService.currentSession(request.cookies[sessionCookieName]);
      request.admin = admin;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  if (!request.admin) {
    next(unauthorizedError());
    return;
  }

  if (request.admin.role !== 'ADMIN') {
    next(forbiddenError());
    return;
  }

  next();
}
