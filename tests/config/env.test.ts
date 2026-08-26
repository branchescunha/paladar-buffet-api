import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3333',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
  APP_URL: 'http://localhost:3333',
  WEB_URL: 'http://localhost:5173',
  SESSION_SECRET: '12345678901234567890123456789012'
};

describe('parseEnv', () => {
  it('accepts a secure complete environment', () => {
    expect(parseEnv(validEnv).PORT).toBe(3333);
  });

  it('rejects a weak session secret', () => {
    expect(() => parseEnv({ ...validEnv, SESSION_SECRET: 'short' })).toThrow();
  });
});
