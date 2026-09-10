import { describe, expect, it, vi } from 'vitest';
import { PrismaProposalPdfService } from '../../src/modules/proposals/prisma-proposal-pdf.service.js';

describe('PrismaProposalPdfService', () => {
  it('renders persisted proposal data in a PDF without writing the proposal', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      customer: { name: 'Ana Souza', phone: '61999999999', email: 'ana@example.com' },
      event: { eventType: 'Casamento', eventDate: new Date('2099-10-01T12:00:00.000Z'), eventTime: '19:30', location: 'Brasília', guestCount: 120 },
      quoteRequest: { fullName: 'Ana Souza' }, description: 'Buffet completo', notes: 'Serviço de mesa incluso.', validUntil: new Date('2099-09-20T12:00:00.000Z'), status: 'ENVIADA', subtotalCents: 200000, adjustmentCents: -10000, totalCents: 190000, createdAt: new Date('2099-09-01T12:00:00.000Z'),
      items: [{ description: 'Buffet', quantity: 2, unitPriceCents: 100000, subtotalCents: 200000 }]
    });
    const service = new PrismaProposalPdfService({ proposal: { findUnique } } as never);

    const result = await service.generate('proposal-1');

    expect(result?.subarray(0, 4).toString()).toBe('%PDF');
    const content = result?.toString('latin1') ?? '';
    expect(content).toContain('Proposta Comercial');
    expect(content).toContain(Buffer.from('Ana Souza').toString('hex'));
    expect(content).toContain(Buffer.from('Status:').toString('hex'));
    expect(content).toContain('20456e');
    expect(content).toContain('7669616461');
    expect(content).toContain('42756666');
    expect(content).toContain('6574');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('paginates the maximum supported number of items without creating runaway pages', async () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ description: `Serviço ${index + 1}`, quantity: 1, unitPriceCents: 1000, subtotalCents: 1000 }));
    const findUnique = vi.fn().mockResolvedValue({
      customer: { name: 'Ana Souza', phone: '61999999999', email: null },
      event: null, quoteRequest: null, description: null, notes: null, validUntil: new Date('2099-09-20T12:00:00.000Z'), status: 'RASCUNHO', subtotalCents: 100000, adjustmentCents: 0, totalCents: 100000, createdAt: new Date('2099-09-01T12:00:00.000Z'), items
    });
    const service = new PrismaProposalPdfService({ proposal: { findUnique } } as never);

    const result = await service.generate('proposal-1');
    const pageCount = Number((result?.toString('latin1') ?? '').match(/\/Count (\d+)/)?.[1]);

    expect(pageCount).toBeLessThanOrEqual(5);
  });
});
