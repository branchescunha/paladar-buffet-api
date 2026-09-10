import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireAdmin, requireOwner } from '../../src/modules/auth/auth.middleware.js';

function requestWithAdmin(role: 'OWNER' | 'ADMIN', mustChangePassword = false) {
  return {
    admin: {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@paladarbuffet.com.br',
      role,
      avatarUrl: null,
      mustChangePassword
    }
  } as Request;
}

function runMiddleware(
  middleware: (request: Request, response: Response, next: NextFunction) => void,
  request: Request
) {
  const next = vi.fn();
  middleware(request, {} as Response, next);
  return next;
}

describe('admin authorization middleware', () => {
  it.each(['ADMIN', 'OWNER'] as const)('allows %s to access normal administrative operations', (role) => {
    const next = runMiddleware(requireAdmin, requestWithAdmin(role));

    expect(next).toHaveBeenCalledWith();
  });

  it('allows only OWNER through owner-exclusive authorization', () => {
    const ownerNext = runMiddleware(requireOwner, requestWithAdmin('OWNER'));
    const adminNext = runMiddleware(requireOwner, requestWithAdmin('ADMIN'));

    expect(ownerNext).toHaveBeenCalledWith();
    expect(adminNext.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('blocks normal administrative operations until the initial password is changed', () => {
    const next = runMiddleware(requireAdmin, requestWithAdmin('ADMIN', true));

    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
  });
});
