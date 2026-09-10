import type { NextFunction, Request, Response } from 'express';
import { forbiddenError, passwordChangeRequiredError, unauthorizedError } from '../../shared/errors.js';
import { csrfCookieName, sessionCookieName } from './auth.cookies.js';
import type { AuthService } from './auth.service.js';

const csrfProtectedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfProtection(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    if (!csrfProtectedMethods.has(request.method)) {
      next();
      return;
    }

    const csrfCookie = request.cookies[csrfCookieName];
    const csrfHeader = request.header('x-csrf-token');

    if (!csrfCookie || csrfCookie !== csrfHeader) {
      next(forbiddenError());
      return;
    }

    try {
      await authService.validateCsrf(request.cookies[sessionCookieName], csrfHeader);
      next();
    } catch (error) {
      next(error);
    }
  };
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

  if (request.admin.role !== 'ADMIN' && request.admin.role !== 'OWNER') {
    next(forbiddenError());
    return;
  }

  if (request.admin.mustChangePassword) {
    next(passwordChangeRequiredError());
    return;
  }

  next();
}

export function requireOwner(request: Request, _response: Response, next: NextFunction) {
  if (!request.admin) {
    next(unauthorizedError());
    return;
  }

  if (request.admin.role !== 'OWNER') {
    next(forbiddenError());
    return;
  }

  if (request.admin.mustChangePassword) {
    next(passwordChangeRequiredError());
    return;
  }

  next();
}
