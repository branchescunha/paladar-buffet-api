import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import type { QuoteRequestService } from '../../src/modules/quote-requests/quote-request.service.js';

type QuoteRequestServiceMock = QuoteRequestService & {
  listAdmin: ReturnType<typeof vi.fn>;
  findAdminById: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeAuthService(role: 'OWNER' | 'ADMIN' = 'ADMIN') {
  return {
    currentSession: vi.fn().mockResolvedValue({
      admin: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@paladarbuffet.com',
        role,
        mustChangePassword: false
      }
      }),
    validateCsrf: vi.fn().mockResolvedValue(undefined)
  } as unknown as AuthService;
}

function makeQuoteRequestService(): QuoteRequestServiceMock {
  return {
    create: vi.fn(),
    listLatest: vi.fn().mockResolvedValue([]),
    listAdmin: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'quote-1',
          fullName: 'Ana Souza',
          email: 'ana@example.com',
          phone: '61999999999',
          eventType: 'casamento',
          eventTypeOther: null,
          eventDate: new Date('2099-09-20T12:00:00.000Z'),
          eventTime: '19:30',
          guestCount: 120,
          location: 'Brasília',
          preferredContact: 'whatsapp',
          status: 'NOVA',
          createdAt: new Date('2099-08-20T12:00:00.000Z')
        }
      ],
      total: 1
    }),
    findAdminById: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue({ id: 'quote-1', status: 'EM_ANALISE' }),
    delete: vi.fn().mockResolvedValue(true)
  } as unknown as QuoteRequestServiceMock;
}

describe('admin quote requests', () => {
  it('does not expose the administrative list without a session', async () => {
    const response = await request(createApp()).get('/admin/quote-requests');

    expect(response.status).toBe(401);
  });

  it.each(['OWNER', 'ADMIN'] as const)('lists and filters requests for %s', async (role) => {
    const quoteRequestService = makeQuoteRequestService();
    const response = await request(createApp({ authService: makeAuthService(role), quoteRequestService }))
      .get('/admin/quote-requests')
      .query({ search: 'Ana', status: 'NOVA' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 1,
      items: [{ id: 'quote-1', fullName: 'Ana Souza', status: 'NOVA' }]
    });
    expect(quoteRequestService.listAdmin).toHaveBeenCalledWith({ search: 'Ana', status: 'NOVA' });
  });

  it('returns full details only through the protected administrative route', async () => {
    const quoteRequestService = makeQuoteRequestService();
    quoteRequestService.findAdminById.mockResolvedValue({
      id: 'quote-1',
      fullName: 'Ana Souza',
      email: 'ana@example.com',
      phone: '61999999999',
      eventType: 'casamento',
      eventTypeOther: null,
      eventDate: new Date('2099-09-20T12:00:00.000Z'),
      eventTime: '19:30',
      guestCount: 120,
      location: 'Brasília',
      preferredContact: 'whatsapp',
      status: 'NOVA',
      message: 'Gostaria de um buffet completo.',
      menuPreferences: ['jantar'],
      serviceNeeds: ['garcons'],
      dietaryRestrictions: null,
      acceptedPrivacy: true,
      source: 'public_site',
      createdAt: new Date('2099-08-20T12:00:00.000Z'),
      updatedAt: new Date('2099-08-20T12:00:00.000Z')
    });

    const response = await request(createApp({ authService: makeAuthService(), quoteRequestService })).get(
      '/admin/quote-requests/quote-1'
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'quote-1',
      message: 'Gostaria de um buffet completo.',
      menuPreferences: ['jantar'],
      serviceNeeds: ['garcons']
    });
  });

  it('updates a request status through the protected administrative route', async () => {
    const quoteRequestService = makeQuoteRequestService();
    const response = await request(createApp({ authService: makeAuthService(), quoteRequestService }))
      .patch('/admin/quote-requests/quote-1/status')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({ status: 'EM_ANALISE' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'quote-1', status: 'EM_ANALISE' });
    expect(quoteRequestService.updateStatus).toHaveBeenCalledWith('quote-1', 'EM_ANALISE');
  });

  it('deletes a request through authenticated and CSRF-protected administration', async () => {
    const quoteRequestService = makeQuoteRequestService();
    const response = await request(createApp({ authService: makeAuthService(), quoteRequestService }))
      .delete('/admin/quote-requests/quote-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(204);
    expect(quoteRequestService.delete).toHaveBeenCalledWith('quote-1');
  });

  it('returns not found when deleting a missing request', async () => {
    const quoteRequestService = makeQuoteRequestService();
    quoteRequestService.delete.mockResolvedValue(false);
    const response = await request(createApp({ authService: makeAuthService(), quoteRequestService }))
      .delete('/admin/quote-requests/missing')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(404);
  });
});
