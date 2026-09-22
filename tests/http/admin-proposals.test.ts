import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';

const authService = {
  currentSession: vi.fn().mockResolvedValue({ admin: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false } }),
  validateCsrf: vi.fn().mockResolvedValue(undefined)
} as unknown as AuthService;

describe('admin proposals', () => {
  it('generates a PDF only for an authenticated administrator', async () => {
    const pdfService = { generate: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7 proposal')) };
    const unauthorized = await request(createApp({ pdfService } as never)).get('/admin/proposals/proposal-1/pdf');
    expect(unauthorized.status).toBe(401);

    const response = await request(createApp({ authService, pdfService } as never))
      .get('/admin/proposals/proposal-1/pdf')
      .set('Cookie', 'paladar_admin_session=session');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(pdfService.generate).toHaveBeenCalledWith('proposal-1');
  });
  it('creates a protected proposal and ignores client supplied totals', async () => {
    const proposalService = { list: vi.fn(), findById: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'proposal-1', subtotalCents: 20000, totalCents: 19000 }), update: vi.fn(), updateStatus: vi.fn(), createDraftFromQuote: vi.fn(), countSent: vi.fn() };
    const response = await request(createApp({ authService, proposalService } as never))
      .post('/admin/proposals').set('Cookie', ['paladar_admin_session=session', 'paladar_csrf=csrf']).set('x-csrf-token', 'csrf')
      .send({ customerId: 'customer-1', validUntil: '2099-10-01', adjustmentCents: -1000, subtotalCents: 1, totalCents: 1, items: [{ description: 'Buffet', quantity: 2, unitPriceCents: 10000 }] });
    expect(response.status).toBe(201);
    expect(proposalService.create.mock.calls[0]?.[0]).not.toHaveProperty('subtotalCents');
    expect(proposalService.create).toHaveBeenCalledWith(expect.any(Object), 'admin-1');
  });

  it('returns the existing draft when a quote is clicked repeatedly', async () => {
    const proposalService = { list: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), createDraftFromQuote: vi.fn().mockResolvedValue({ id: 'proposal-1', status: 'RASCUNHO' }), countSent: vi.fn() };
    const response = await request(createApp({ authService, proposalService } as never))
      .post('/admin/quote-requests/quote-1/proposal-draft').set('Cookie', ['paladar_admin_session=session', 'paladar_csrf=csrf']).set('x-csrf-token', 'csrf').send({});
    expect(response.status).toBe(201);
    expect(proposalService.createDraftFromQuote).toHaveBeenCalledWith('quote-1', 'admin-1');
  });

  it('deletes an existing proposal through the protected route', async () => {
    const proposalService = { delete: vi.fn().mockResolvedValue(true) };

    const response = await request(createApp({ authService, proposalService } as never))
      .delete('/admin/proposals/proposal-1')
      .set('Cookie', ['paladar_admin_session=session', 'paladar_csrf=csrf'])
      .set('x-csrf-token', 'csrf');

    expect(response.status).toBe(204);
  });

  it('returns 404 when deleting a proposal that does not exist', async () => {
    const proposalService = { delete: vi.fn().mockResolvedValue(false) };

    const response = await request(createApp({ authService, proposalService } as never))
      .delete('/admin/proposals/missing-proposal')
      .set('Cookie', ['paladar_admin_session=session', 'paladar_csrf=csrf'])
      .set('x-csrf-token', 'csrf');

    expect(response.status).toBe(404);
  });

  it('requires authentication and CSRF protection to delete proposals', async () => {
    const proposalService = { delete: vi.fn().mockResolvedValue(true) };

    expect((await request(createApp({ proposalService } as never)).delete('/admin/proposals/proposal-1')).status).toBe(401);
    expect((await request(createApp({ authService, proposalService } as never)).delete('/admin/proposals/proposal-1').set('Cookie', 'paladar_admin_session=session')).status).toBe(403);
  });
});
