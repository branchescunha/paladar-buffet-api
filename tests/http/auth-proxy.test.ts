import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.resetModules();
});

describe('authentication behind a reverse proxy', () => {
  it('accepts a forwarded client IP on the rate-limited login route in production', async () => {
    process.env.NODE_ENV = 'production';
    vi.resetModules();

    const { createApp } = await import('../../src/app.js');
    const authService = {
      login: vi.fn().mockResolvedValue({
        admin: { id: 'admin-1', name: 'Admin', email: 'admin@paladarbuffet.com', role: 'ADMIN', mustChangePassword: false },
        sessionToken: 'session-token',
        csrfToken: 'csrf-token'
      })
    };

    const app = createApp({ authService } as never);
    const response = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.42')
      .send({ email: 'admin@paladarbuffet.com', password: 'SenhaSegura123' });

    expect(app.get('trust proxy')).toBe(1);
    expect(response.status).toBe(200);
    expect(authService.login).toHaveBeenCalledOnce();
  }, 15_000);
});
