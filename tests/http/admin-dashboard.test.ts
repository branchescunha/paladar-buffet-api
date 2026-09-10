import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import type { QuoteRequestService } from '../../src/modules/quote-requests/quote-request.service.js';

describe('GET /admin/dashboard', () => {
  it('requires an authenticated administrative session', async () => {
    const response = await request(createApp()).get('/admin/dashboard');

    expect(response.status).toBe(401);
  });

  it.each(['OWNER', 'ADMIN'] as const)('returns real dashboard data for %s', async (role) => {
    const authService = {
      currentSession: vi.fn().mockResolvedValue({
        admin: {
          id: 'admin-1',
          name: 'Admin',
          email: 'admin@paladarbuffet.com',
          role,
          mustChangePassword: false
        }
      })
    } as unknown as AuthService;
    const quoteRequestService = {
      create: vi.fn(),
      listLatest: vi.fn().mockResolvedValue([
        {
          id: 'quote-1',
          fullName: 'Ana Souza',
          eventType: 'casamento',
          eventTypeOther: null,
          eventDate: new Date('2099-09-20T12:00:00.000Z'),
          eventTime: '19:30',
          guestCount: 120,
          createdAt: new Date('2099-08-20T12:00:00.000Z')
        }
      ]),
      getDashboardMetrics: vi.fn().mockResolvedValue({ newRequests: 0, inProgress: 0 })
    } as unknown as QuoteRequestService;
    const eventService = { countConfirmed: vi.fn().mockResolvedValue(2) };
    const proposalService = { countSent: vi.fn().mockResolvedValue(0) };

    const response = await request(createApp({ authService, quoteRequestService, eventService, proposalService } as never)).get('/admin/dashboard');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      metrics: {
        newRequests: 0,
        inProgress: 0,
        proposalsSent: 0,
        approvedEvents: 2
      },
      latestRequests: [{ id: 'quote-1', fullName: 'Ana Souza', eventTime: '19:30' }]
    });
  });
});
