import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env.js';

export const sessionCookieName = 'paladar_admin_session';
export const csrfCookieName = 'paladar_csrf';

export function cookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.SESSION_SAME_SITE,
    domain: env.SESSION_COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

export function setAuthCookies(response: Response, env: Env, sessionToken: string, csrfToken: string) {
  response.cookie(sessionCookieName, sessionToken, cookieOptions(env));
  response.cookie(csrfCookieName, csrfToken, {
    ...cookieOptions(env),
    httpOnly: false
  });
}

export function clearAuthCookies(response: Response, env: Env) {
  response.clearCookie(sessionCookieName, cookieOptions(env));
  response.clearCookie(csrfCookieName, { ...cookieOptions(env), httpOnly: false });
}
