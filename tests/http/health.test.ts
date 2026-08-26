import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('GET /health', () => {
  it('returns safe operational information', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'paladar-buffet-api',
      environment: 'test'
    });
    expect(JSON.stringify(response.body)).not.toContain('DATABASE_URL');
  });
});
