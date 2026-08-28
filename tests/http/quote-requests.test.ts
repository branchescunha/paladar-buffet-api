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
  guestCount: 120,
  location: 'Brasilia-DF',
  message: 'Gostaria de um buffet completo para casamento.',
  preferredContact: 'whatsapp',
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
});
