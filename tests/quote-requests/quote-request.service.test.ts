import { describe, expect, it, vi } from 'vitest';
import { DefaultQuoteRequestService, type QuoteRequestRepository } from '../../src/modules/quote-requests/quote-request.service.js';

describe('DefaultQuoteRequestService', () => {
  it('returns the latest five quote requests for the administrative dashboard', async () => {
    const latestRequests = [
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
    ];
    const repository = {
      create: vi.fn(),
      listLatest: vi.fn().mockResolvedValue(latestRequests)
    };
    const service = new DefaultQuoteRequestService(repository as unknown as QuoteRequestRepository) as unknown as {
      listLatest(): Promise<typeof latestRequests>;
    };

    await expect(service.listLatest()).resolves.toEqual(latestRequests);
    expect(repository.listLatest).toHaveBeenCalledWith(5);
  });
});
