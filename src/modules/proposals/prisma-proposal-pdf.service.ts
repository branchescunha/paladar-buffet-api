import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import type { ProposalPdfService } from './proposal-pdf.service.js';

const logoPath = resolve(process.cwd(), 'assets', 'paladar-logo.webp');
let logoBuffer: Promise<Buffer> | undefined;

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADA: 'Enviada', APROVADA: 'Aprovada', RECUSADA: 'Recusada', CANCELADA: 'Cancelada'
};

export class PrismaProposalPdfService implements ProposalPdfService {
  constructor(private readonly prisma: import('@prisma/client').PrismaClient) {}

  async generate(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { customer: true, event: true, quoteRequest: { select: { fullName: true } }, items: { orderBy: { position: 'asc' } } }
    });
    if (!proposal) return null;
    return renderPdf(proposal, await getLogo());
  }
}

async function getLogo() {
  logoBuffer ??= readFile(logoPath).then((source) => sharp(source).png().toBuffer());
  return logoBuffer;
}

function renderPdf(proposal: {
  customer: { name: string; phone: string; email: string | null };
  event: { eventType: string; eventDate: Date; eventTime: string; location: string; guestCount: number } | null;
  quoteRequest: { fullName: string } | null;
  description: string | null;
  notes: string | null;
  validUntil: Date;
  status: string;
  subtotalCents: number;
  adjustmentCents: number;
  totalCents: number;
  createdAt: Date;
  items: Array<{ description: string; quantity: number; unitPriceCents: number; subtotalCents: number }>;
}, logo: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48, compress: false, info: { Title: 'Proposta Comercial - Paladar Buffet' } });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.image(logo, 48, 44, { fit: [120, 54] });
    document.fillColor('#18352A').fontSize(20).font('Helvetica-Bold').text('Proposta Comercial', 360, 50, { align: 'right' });
    document.fillColor('#5C665E').fontSize(9).font('Helvetica').text(`Emitida em ${formatDate(proposal.createdAt)}`, 360, 76, { align: 'right' });
    document.text(`Status: ${statusLabels[proposal.status] ?? proposal.status}`, 360, 90, { align: 'right' });
    line(document, 112);

    section(document, 'Paladar Buffet', 128);
    document.fillColor('#313A34').fontSize(10).font('Helvetica').text('Brasília/DF e região\nAtendimento personalizado para eventos e celebrações.', 48, 146);
    section(document, 'Cliente', 194);
    document.fillColor('#313A34').fontSize(10).font('Helvetica').text([proposal.customer.name, proposal.customer.phone, proposal.customer.email].filter(Boolean).join('\n'), 48, 212);

    let cursor = 268;
    if (proposal.event) {
      section(document, 'Evento', cursor);
      document.fillColor('#313A34').fontSize(10).font('Helvetica').text(`${proposal.event.eventType}\n${formatDate(proposal.event.eventDate)} às ${proposal.event.eventTime}\n${proposal.event.location} · ${proposal.event.guestCount} convidados`, 48, cursor + 18);
      cursor += 82;
    }
    if (proposal.description) { section(document, 'Descrição', cursor); document.fillColor('#313A34').fontSize(10).font('Helvetica').text(proposal.description, 48, cursor + 18, { width: 500 }); cursor += 54; }

    let y = itemTableHeader(document, cursor, 'Itens e serviços');
    document.font('Helvetica').fillColor('#313A34').fontSize(9);
    for (const item of proposal.items) {
      const rowHeight = Math.max(20, Math.ceil(document.heightOfString(item.description, { width: 265 })) + 6);
      if (y + rowHeight > 710) {
        document.addPage();
        y = itemTableHeader(document, 48, 'Itens e serviços (continuação)');
        document.font('Helvetica').fillColor('#313A34').fontSize(9);
      }
      document.text(item.description, 48, y, { width: 265 }).text(String(item.quantity), 325, y, { width: 45, align: 'right' }).text(formatMoney(item.unitPriceCents), 380, y, { width: 72, align: 'right' }).text(formatMoney(item.subtotalCents), 462, y, { width: 84, align: 'right' });
      y += rowHeight;
    }
    if (y + 130 > 730) { document.addPage(); y = 48; }
    line(document, y + 2);
    y += 12;
    document.font('Helvetica').text('Subtotal', 380, y, { width: 72, align: 'right' }).text(formatMoney(proposal.subtotalCents), 462, y, { width: 84, align: 'right' });
    y += 18;
    document.text(proposal.adjustmentCents < 0 ? 'Desconto' : 'Acréscimo', 380, y, { width: 72, align: 'right' }).text(formatMoney(proposal.adjustmentCents), 462, y, { width: 84, align: 'right' });
    y += 22;
    document.fillColor('#18352A').font('Helvetica-Bold').fontSize(12).text('Total final', 355, y, { width: 97, align: 'right' }).text(formatMoney(proposal.totalCents), 462, y, { width: 84, align: 'right' });
    y += 38;
    section(document, 'Validade', y);
    document.fillColor('#313A34').font('Helvetica').fontSize(10).text(`Esta proposta é válida até ${formatDate(proposal.validUntil)}.`, 48, y + 18);
    if (proposal.notes) { y += 56; section(document, 'Observações', y); document.fillColor('#313A34').font('Helvetica').fontSize(10).text(proposal.notes, 48, y + 18, { width: 500 }); }
    document.fillColor('#5C665E').fontSize(8).font('Helvetica').text('Paladar Buffet · Proposta comercial gerada para atendimento.', 48, 770, { width: 500, align: 'center' });
    document.end();
  });
}

function section(document: PDFKit.PDFDocument, label: string, y: number) { document.fillColor('#B9723E').font('Helvetica-Bold').fontSize(9).text(label.toUpperCase(), 48, y); }
function line(document: PDFKit.PDFDocument, y: number) { document.moveTo(48, y).lineTo(547, y).strokeColor('#D9DED8').lineWidth(0.7).stroke(); }
function itemTableHeader(document: PDFKit.PDFDocument, y: number, label: string) {
  section(document, label, y);
  const tableTop = y + 22;
  document.fillColor('#18352A').font('Helvetica-Bold').fontSize(9).text('SERVIÇO', 48, tableTop).text('QTD.', 325, tableTop, { width: 45, align: 'right' }).text('UNITÁRIO', 380, tableTop, { width: 72, align: 'right' }).text('SUBTOTAL', 462, tableTop, { width: 84, align: 'right' });
  return tableTop + 18;
}
function formatMoney(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function formatDate(date: Date) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date); }
