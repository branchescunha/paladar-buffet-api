import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { QuoteRequestService } from '../../src/modules/quote-requests/quote-request.service.js';

const validPayload = {
  fullName: 'Andre Vinicius',
  email: 'andre@example.com',
  phone: '(61) 98416-3455',
  eventType: 'casamento',
  eventDate: '2099-09-20',
  eventTime: '19:30',
  guestCount: 120,
  location: 'Brasilia-DF',
  message: 'Gostaria de um buffet completo para casamento.',
  preferredContact: 'whatsapp',
  menuOptionIds: ['menu-option-hot-01'],
  acceptedPrivacy: true
};

function makeService(): QuoteRequestService & { inputs: unknown[] } {
  const inputs: unknown[] = [];

  return {
    inputs,
    async create(input) {
      inputs.push(input);
      return {
        id: 'quote-1',
        createdAt: new Date('2099-09-20T12:00:00.000Z')
      };
    },
    async listLatest() {
      return [];
    },
    async getDashboardMetrics() {
      return { newRequests: 0, inProgress: 0 };
    },
    async listAdmin() {
      return { items: [], total: 0 };
    },
    async findAdminById() {
      return null;
    },
    async updateStatus() {
      return null;
    }
  };
}

describe('POST /quote-requests', () => {
  it('persists a valid public quote request and returns the public receipt', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService })).post('/quote-requests').send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'quote-1',
      createdAt: '2099-09-20T12:00:00.000Z'
    });
    expect(quoteRequestService.inputs).toHaveLength(1);
    expect(quoteRequestService.inputs[0]).toMatchObject({ eventTime: '19:30' });
  });

  it('rejects submissions without the expected event time', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService }))
      .post('/quote-requests')
      .send({ ...validPayload, eventTime: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(quoteRequestService.inputs).toHaveLength(0);
  });

  it('does not persist honeypot submissions while returning a neutral receipt', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService }))
      .post('/quote-requests')
      .send({ ...validPayload, website: 'https://spam.example' });

    expect(response.status).toBe(201);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(quoteRequestService.inputs).toHaveLength(0);
  });

  it('rejects invalid public quote request payloads', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService }))
      .post('/quote-requests')
      .send({ ...validPayload, acceptedPrivacy: false });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(quoteRequestService.inputs).toHaveLength(0);
  });

  it('returns a safe public validation error instead of enum internals', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService }))
      .post('/quote-requests')
      .send({ ...validPayload, eventType: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.'
    });
    expect(JSON.stringify(response.body)).not.toMatch(/invalid enum|expected|received|zod|prisma/i);
    expect(quoteRequestService.inputs).toHaveLength(0);
  });

  it('rejects unexpected fields instead of passing request body through', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService }))
      .post('/quote-requests')
      .send({ ...validPayload, status: 'approved' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(quoteRequestService.inputs).toHaveLength(0);
  });

  it('rejects unmapped checkbox values while keeping public text fields flexible', async () => {
    const quoteRequestService = makeService();
    const response = await request(createApp({ quoteRequestService }))
      .post('/quote-requests')
      .send({ ...validPayload, menuPreferences: ['jantar', 'drop-table'] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(quoteRequestService.inputs).toHaveLength(0);
  });
});
