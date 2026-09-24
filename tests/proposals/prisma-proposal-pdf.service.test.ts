import { describe, expect, it, vi } from 'vitest';
import { PrismaProposalPdfService } from '../../src/modules/proposals/prisma-proposal-pdf.service.js';

describe('PrismaProposalPdfService', () => {
  it('renders persisted proposal data in a PDF without writing the proposal', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      customer: { name: 'Ana Souza', phone: '61999999999', email: 'ana@example.com' },
      event: { eventType: 'casamento', eventDate: new Date('2099-10-01T12:00:00.000Z'), eventTime: '19:30', location: 'Brasília', guestCount: 120 },
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
    expect(content).toContain(Buffer.from('Casamento').toString('hex'));
    expect(content).toContain(Buffer.from('aladar Buff').toString('hex'));
    expect(content).toContain(Buffer.from('et - Proposta comercial').toString('hex'));
    expect(Number(content.match(/\/Count (\d+)/)?.[1])).toBe(1);
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

  it('renders and paginates a complete per-guest commercial proposal from snapshots', async () => {
    const menuSelections = representativeMenuSelections();
    const findUnique = vi.fn().mockResolvedValue({
      pricingMode: 'PER_GUEST',
      customer: { name: 'Ana Souza', phone: '61999999999', email: 'ana@example.com' },
      event: { eventType: 'casamento', eventDate: new Date('2099-10-01T12:00:00.000Z'), eventTime: '19:30', location: 'Espaço de eventos - Brasília/DF', guestCount: 120 },
      quoteRequest: { fullName: 'Ana Souza' },
      description: 'Recepção completa para casamento', notes: 'Equipe uniformizada e montagem conforme alinhamento comercial.',
      validUntil: new Date('2099-09-20T12:00:00.000Z'), status: 'ENVIADA',
      guestCount: 120, pricePerGuestCents: 18990, baseTotalCents: 2278800,
      subtotalCents: 2278800, adjustmentCents: -50000, totalCents: 2228800,
      createdAt: new Date('2099-09-01T12:00:00.000Z'), items: [],
      includedServices: [
        { description: 'Buffet completo' }, { description: 'Garçons' }, { description: 'Maître' },
        { description: 'Coordenação de eventos' }, { description: 'Estrutura necessária' },
        { description: 'Pratarias e utensílios' }
      ],
      paymentInstallments: [
        { description: 'Na contratação', percentage: 50, position: 0 },
        { description: 'No dia do evento', percentage: 50, position: 1 }
      ],
      paymentMethods: [
        { name: 'Pix', pixKey: 'paladar@exemplo.com', instructions: 'Identificar o pagamento com o nome do cliente.', position: 0 },
        { name: 'Cartão de crédito', pixKey: null, instructions: 'Condições conforme alinhamento comercial.', position: 1 }
      ],
      menuSelections,
      responsibleNameSnapshot: 'Lethicia Byanca Santos Cunha', responsibleTitleSnapshot: 'Gerente Administrativo'
    });
    const service = new PrismaProposalPdfService({ proposal: { findUnique } } as never);

    const result = await service.generate('proposal-per-guest');
    const content = result?.toString('latin1') ?? '';
    const pageCount = Number(content.match(/\/Count (\d+)/)?.[1]);

    const extractedText = extractPdfText(content);
    for (const expected of [
      'Ana Souza', 'Recepção completa', 'Barquete de guacamole', 'Penne ao molho quatro queijos',
      'Salada tropical', 'Filé ao molho madeira', 'Mesa do café', 'Garçons', 'Na contratação',
      'Cartão de crédito', 'Lethicia Byanca Santos Cunha', 'Gerente Administrativo'
    ]) {
      expect(extractedText).toContain(expected);
    }
    expect(extractedText).toContain(
      'EntradasEntradas quentes- Fricassê de frango- Camarão internacionalEntradas frias- Barquete de guacamole'
    );
    expect(extractedText).toContain(
      'AcompanhamentosArroz- Arroz piemontês- Arroz brancoMassas- Penne ao molho quatro queijos- Talharim ao molho sugo'
    );
    expect(extractedText).not.toContain('SaladasSaladas');
    expect(extractedText).not.toContain('BebidasBebidas');
    expect(extractedText).not.toContain('Mesa do caféMesa do café');
    expect(pageCount).toBe(2);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ menuSelections: expect.any(Object), paymentMethods: expect.any(Object) })
    }));
  });
});

function representativeMenuSelections() {
  const selections = [
    ['Entradas', 1, 'Entradas quentes', 1, 'Fricassê de frango', 1],
    ['Entradas', 1, 'Entradas quentes', 1, 'Camarão internacional', 2],
    ['Entradas', 1, 'Entradas frias', 2, 'Barquete de guacamole', 1],
    ['Acompanhamentos', 2, 'Arroz', 1, 'Arroz piemontês', 1],
    ['Acompanhamentos', 2, 'Arroz', 1, 'Arroz branco', 2],
    ['Acompanhamentos', 2, 'Massas', 2, 'Penne ao molho quatro queijos', 1],
    ['Acompanhamentos', 2, 'Massas', 2, 'Talharim ao molho sugo', 2],
    ['Saladas', 3, 'Saladas', 1, 'Salada tropical', 1],
    ['Saladas', 3, 'Saladas', 1, 'Salada caprese', 2],
    ['Proteínas', 4, 'Proteínas', 1, 'Filé ao molho madeira', 1],
    ['Proteínas', 4, 'Proteínas', 1, 'Frango grelhado', 2],
    ['Proteínas', 4, 'Proteínas', 1, 'Lombo assado', 3],
    ['Bebidas', 5, 'Bebidas', 1, 'Suco natural', 1],
    ['Bebidas', 5, 'Bebidas', 1, 'Refrigerantes', 2],
    ['Bebidas', 5, 'Bebidas', 1, 'Água mineral', 3],
    ['Mesa do café', 6, 'Mesa do café', 1, 'Café', 1],
    ['Mesa do café', 6, 'Mesa do café', 1, 'Chás variados', 2],
    ['Mesa do café', 6, 'Mesa do café', 1, 'Petit fours', 3]
  ] as const;
  return selections.map(([groupName, groupPosition, sectionName, sectionPosition, optionName, optionPosition]) => ({
    groupName, groupPosition, sectionName, sectionPosition, optionName, optionPosition
  }));
}

function extractPdfText(content: string) {
  const hexadecimalRuns = [...content.matchAll(/<([0-9a-f]+)>/gi)].map((match) => match[1]).join('');
  return Buffer.from(hexadecimalRuns, 'hex').toString('latin1');
}
