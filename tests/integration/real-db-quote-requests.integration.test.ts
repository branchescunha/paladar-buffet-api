import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const runRealDbTests = process.env.RUN_REAL_DB_TESTS === '1';
const prisma = new PrismaClient();
const testRunId = `quote-real-db-${Date.now()}`;
const testEmail = `${testRunId}@paladarbuffet.test`;

describe.runIf(runRealDbTests)('real database quote requests', () => {
  afterAll(async () => {
    await prisma.quoteRequest.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it('persists a public quote request through HTTP', async () => {
    const response = await request(createApp()).post('/quote-requests').send({
      fullName: 'Real DB Quote Test',
      email: testEmail,
      phone: '(61) 98416-3455',
      eventType: 'casamento',
      eventDate: '2099-09-20',
      eventTime: '19:30',
      guestCount: 120,
      location: 'Brasilia-DF',
      message: 'Solicitacao real de teste automatizado.',
      preferredContact: 'whatsapp',
      menuPreferences: ['jantar'],
      serviceNeeds: ['garcons'],
      acceptedPrivacy: true
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toEqual(expect.any(String));

    const saved = await prisma.quoteRequest.findUniqueOrThrow({ where: { id: response.body.id as string } });
    expect(saved.email).toBe(testEmail);
    expect(saved.phone).toBe('61984163455');
    expect(saved.eventTime).toBe('19:30');
    expect(saved.acceptedPrivacy).toBe(true);
  });
});
