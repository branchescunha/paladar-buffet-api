import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import { ApiError } from '../../src/shared/errors.js';

function makeAuthService() {
  return {
    currentSession: vi.fn().mockResolvedValue({
      admin: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@paladarbuffet.com',
        role: 'ADMIN',
        mustChangePassword: false
      }
    }),
    validateCsrf: vi.fn().mockResolvedValue(undefined)
  } as unknown as AuthService;
}

describe('admin customers and events', () => {
  it('does not expose customers without an administrative session', async () => {
    const response = await request(createApp()).get('/admin/customers');

    expect(response.status).toBe(401);
  });

  it('creates a customer through the protected administrative route', async () => {
    const customerService = {
      create: vi.fn().mockResolvedValue({ id: 'customer-1', name: 'Ana Souza' }),
      list: vi.fn(),
      findById: vi.fn(),
      update: vi.fn()
    };

    const response = await request(createApp({ authService: makeAuthService(), customerService } as never))
      .post('/admin/customers')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({ name: 'Ana Souza', phone: '61999999999', email: 'ana@example.com', notes: 'Contato inicial' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'customer-1', name: 'Ana Souza' });
  });

  it('lists, reads and updates customers through protected routes', async () => {
    const customerService = {
      list: vi.fn().mockResolvedValue([{ id: 'customer-1', name: 'Ana Souza' }]),
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue({ id: 'customer-1', name: 'Ana Souza' }),
      update: vi.fn().mockResolvedValue({ id: 'customer-1', name: 'Ana Silva' })
    };
    const app = createApp({ authService: makeAuthService(), customerService } as never);

    expect((await request(app).get('/admin/customers?search=ana').set('Cookie', 'paladar_admin_session=session-token')).status).toBe(200);
    expect((await request(app).get('/admin/customers/customer-1').set('Cookie', 'paladar_admin_session=session-token')).status).toBe(200);
    expect((await request(app).patch('/admin/customers/customer-1').set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token']).set('x-csrf-token', 'csrf-token').send({ name: 'Ana Silva' })).status).toBe(200);
    expect(customerService.update).toHaveBeenCalledWith('customer-1', { name: 'Ana Silva' });
  });

  it('updates a customer when optional notes are empty', async () => {
    const customerService = {
      update: vi.fn().mockResolvedValue({ id: 'customer-1', name: 'Isa' })
    };

    const response = await request(createApp({ authService: makeAuthService(), customerService } as never))
      .patch('/admin/customers/customer-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({
        name: 'Isa',
        phone: '61999999999',
        email: 'isabele@example.com',
        notes: null
      });

    expect(response.status).toBe(200);
    expect(customerService.update).toHaveBeenCalledWith('customer-1', {
      name: 'Isa',
      phone: '61999999999',
      email: 'isabele@example.com',
      notes: null
    });
  });

  it('deletes an existing customer through the protected route', async () => {
    const customerService = { delete: vi.fn().mockResolvedValue(true) };

    const response = await request(createApp({ authService: makeAuthService(), customerService } as never))
      .delete('/admin/customers/customer-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(204);
  });

  it('returns 404 when deleting a customer that does not exist', async () => {
    const customerService = { delete: vi.fn().mockResolvedValue(false) };

    const response = await request(createApp({ authService: makeAuthService(), customerService } as never))
      .delete('/admin/customers/missing-customer')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(404);
  });

  it('returns a business conflict without exposing persistence details when customer dependencies exist', async () => {
    const customerService = {
      delete: vi.fn().mockRejectedValue(new ApiError(409, 'Este cliente possui eventos ou propostas vinculados e n\u00e3o pode ser exclu\u00eddo.', 'RESOURCE_CONFLICT'))
    };

    const response = await request(createApp({ authService: makeAuthService(), customerService } as never))
      .delete('/admin/customers/customer-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'RESOURCE_CONFLICT', message: 'Este cliente possui eventos ou propostas vinculados e n\u00e3o pode ser exclu\u00eddo.' } });
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|P2003|foreign key/i);
  });

  it('requires authentication and CSRF protection to delete customers', async () => {
    const customerService = { delete: vi.fn().mockResolvedValue(true) };
    const app = createApp({ authService: makeAuthService(), customerService } as never);

    expect((await request(createApp({ customerService } as never)).delete('/admin/customers/customer-1')).status).toBe(401);
    expect((await request(app).delete('/admin/customers/customer-1').set('Cookie', 'paladar_admin_session=session-token')).status).toBe(403);
  });

  it('creates an event through the protected administrative route', async () => {
    const eventService = {
      create: vi.fn().mockResolvedValue({ id: 'event-1', status: 'PLANEJAMENTO' }),
      list: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      countConfirmed: vi.fn()
    };

    const response = await request(createApp({ authService: makeAuthService(), eventService } as never))
      .post('/admin/events')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({
        customerId: 'customer-1',
        eventType: 'casamento',
        eventDate: '2099-09-20',
        eventTime: '19:30',
        location: 'Brasília',
        guestCount: 120
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'event-1', status: 'PLANEJAMENTO' });
  });

  it('lists, reads and updates events through protected routes', async () => {
    const eventService = {
      list: vi.fn().mockResolvedValue([{ id: 'event-1', eventType: 'Casamento' }]),
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue({ id: 'event-1', eventType: 'Casamento' }),
      update: vi.fn().mockResolvedValue({ id: 'event-1', status: 'CONFIRMADO' }),
      countConfirmed: vi.fn()
    };
    const app = createApp({ authService: makeAuthService(), eventService } as never);

    expect((await request(app).get('/admin/events?status=PLANEJAMENTO').set('Cookie', 'paladar_admin_session=session-token')).status).toBe(200);
    expect((await request(app).get('/admin/events/event-1').set('Cookie', 'paladar_admin_session=session-token')).status).toBe(200);
    expect((await request(app).patch('/admin/events/event-1').set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token']).set('x-csrf-token', 'csrf-token').send({ status: 'CONFIRMADO' })).status).toBe(200);
    expect(eventService.update).toHaveBeenCalledWith('event-1', { status: 'CONFIRMADO' });
  });

  it('updates an event when optional notes are empty', async () => {
    const eventService = {
      update: vi.fn().mockResolvedValue({ id: 'event-1', status: 'CONFIRMADO' })
    };

    const response = await request(createApp({ authService: makeAuthService(), eventService } as never))
      .patch('/admin/events/event-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({
        customerId: 'customer-1',
        eventType: 'casamento',
        eventDate: '2026-10-01',
        eventTime: '15:00',
        location: 'Brasilia',
        guestCount: 500,
        notes: null,
        status: 'CONFIRMADO'
      });

    expect(response.status).toBe(200);
    expect(eventService.update).toHaveBeenCalledWith('event-1', {
      customerId: 'customer-1',
      eventType: 'casamento',
      eventDate: new Date('2026-10-01T12:00:00.000Z'),
      eventTime: '15:00',
      location: 'Brasilia',
      guestCount: 500,
      notes: null,
      status: 'CONFIRMADO'
    });
  });

  it('deletes an event without proposals through the protected route', async () => {
    const eventService = { delete: vi.fn().mockResolvedValue(true) };

    const response = await request(createApp({ authService: makeAuthService(), eventService } as never))
      .delete('/admin/events/event-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(204);
  });

  it('returns 404 when deleting an event that does not exist', async () => {
    const eventService = { delete: vi.fn().mockResolvedValue(false) };

    const response = await request(createApp({ authService: makeAuthService(), eventService } as never))
      .delete('/admin/events/missing-event')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(404);
  });

  it('returns a business conflict and keeps persistence errors private when an event has proposals', async () => {
    const eventService = {
      delete: vi.fn().mockRejectedValue(new ApiError(409, 'Este evento possui proposta vinculada e n\u00e3o pode ser exclu\u00eddo.', 'RESOURCE_CONFLICT'))
    };

    const response = await request(createApp({ authService: makeAuthService(), eventService } as never))
      .delete('/admin/events/event-1')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'RESOURCE_CONFLICT', message: 'Este evento possui proposta vinculada e n\u00e3o pode ser exclu\u00eddo.' } });
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|P2003|foreign key/i);
  });

  it('requires authentication and CSRF protection to delete events', async () => {
    const eventService = { delete: vi.fn().mockResolvedValue(true) };
    const app = createApp({ authService: makeAuthService(), eventService } as never);

    expect((await request(createApp({ eventService } as never)).delete('/admin/events/event-1')).status).toBe(401);
    expect((await request(app).delete('/admin/events/event-1').set('Cookie', 'paladar_admin_session=session-token')).status).toBe(403);
  });

  it('converts a quote request without changing its current status', async () => {
    const conversionService = {
      convert: vi.fn().mockResolvedValue({ customerId: 'customer-1', eventId: 'event-1', quoteRequestStatus: 'EM_ANALISE' })
    };

    const response = await request(createApp({ authService: makeAuthService(), conversionService } as never))
      .post('/admin/quote-requests/quote-1/convert')
      .set('Cookie', ['paladar_admin_session=session-token', 'paladar_csrf=csrf-token'])
      .set('x-csrf-token', 'csrf-token')
      .send({});

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ customerId: 'customer-1', eventId: 'event-1', quoteRequestStatus: 'EM_ANALISE' });
    expect(conversionService.convert).toHaveBeenCalledWith('quote-1', {});
  });
});
