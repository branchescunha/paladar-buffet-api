import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { calculatePaymentAmounts } from './proposal-commercial.js';
import type { ProposalPdfService } from './proposal-pdf.service.js';

const logoPath = resolve(process.cwd(), 'assets', 'paladar-logo.webp');
let logoBuffer: Promise<Buffer> | undefined;

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADA: 'Enviada', APROVADA: 'Aprovada', RECUSADA: 'Recusada', CANCELADA: 'Cancelada'
};
const eventTypeLabels: Record<string, string> = {
  casamento: 'Casamento', aniversario: 'Aniversário', corporativo: 'Corporativo', confraternizacao: 'Confraternização',
  churrasco: 'Churrasco', reuniao: 'Reunião', 'coffee-break': 'Coffee break', brunch: 'Brunch', outro: 'Outro'
};

type PdfProposal = {
  pricingMode?: string;
  customer: { name: string; phone: string; email: string | null };
  event: { eventType: string; eventDate: Date; eventTime: string; location: string; guestCount: number } | null;
  quoteRequest: { fullName: string } | null;
  description: string | null;
  notes: string | null;
  validUntil: Date;
  status: string;
  guestCount?: number | null;
  pricePerGuestCents?: number | null;
  baseTotalCents?: number | null;
  subtotalCents: number;
  adjustmentCents: number;
  totalCents: number;
  createdAt: Date;
  responsibleNameSnapshot?: string | null;
  responsibleTitleSnapshot?: string | null;
  items: Array<{ description: string; quantity: number; unitPriceCents: number; subtotalCents: number }>;
  includedServices?: Array<{ description: string }>;
  paymentInstallments?: Array<{ description: string; percentage: number; position: number }>;
  paymentMethods?: Array<{ name: string; pixKey: string | null; instructions: string | null; position: number }>;
  menuSelections?: Array<{ groupName: string; groupPosition: number; sectionName: string; sectionPosition: number; optionName: string; optionPosition: number }>;
};

export class PrismaProposalPdfService implements ProposalPdfService {
  constructor(private readonly prisma: import('@prisma/client').PrismaClient) {}

  async generate(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        customer: true,
        event: true,
        quoteRequest: { select: { fullName: true } },
        items: { orderBy: { position: 'asc' } },
        includedServices: { orderBy: { position: 'asc' } },
        paymentInstallments: { orderBy: { position: 'asc' } },
        paymentMethods: { orderBy: { position: 'asc' } },
        menuSelections: { orderBy: [{ groupPosition: 'asc' }, { sectionPosition: 'asc' }, { optionPosition: 'asc' }] }
      }
    });
    if (!proposal) return null;
    const logo = await getLogo();
    return proposal.pricingMode === 'PER_GUEST'
      ? renderPerGuestPdf(proposal, logo)
      : renderItemizedPdf(proposal, logo);
  }
}

async function getLogo() {
  logoBuffer ??= readFile(logoPath).then((source) => sharp(source).png().toBuffer());
  return logoBuffer;
}

function createDocument() {
  const document = new PDFDocument({ autoFirstPage: false, size: 'A4', margin: 48, compress: false, info: { Title: 'Proposta Comercial - Paladar Buffet' } });
  const chunks: Buffer[] = [];
  const completion = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  return { document, completion };
}

function renderPerGuestPdf(proposal: PdfProposal, logo: Buffer) {
  const { document, completion } = createDocument();
  const bottom = 742;
  let y = 0;

  const addPage = (continuation = false) => {
    document.addPage();
    document.image(logo, 48, 36, { fit: [106, 48] });
    document.fillColor('#18352A').fontSize(continuation ? 14 : 20).font('Helvetica-Bold')
      .text(continuation ? 'Proposta Comercial - continuação' : 'Proposta Comercial', 230, 44, { width: 317, align: 'right' });
    document.fillColor('#5C665E').fontSize(9).font('Helvetica')
      .text(`Emitida em ${formatDate(proposal.createdAt)}`, 280, 72, { width: 267, align: 'right' })
      .text(`Status: ${statusLabels[proposal.status] ?? proposal.status}`, 280, 88, { width: 267, align: 'right' });
    line(document, 110);
    document.fillColor('#5C665E').fontSize(8).font('Helvetica').text('Paladar Buffet - Proposta comercial', 48, 778, { width: 500, align: 'center' });
    y = 128;
  };
  const ensureSpace = (height: number) => { if (y + height > bottom) addPage(true); };
  const writeSection = (label: string) => { ensureSpace(34); section(document, label, y); y += 22; };
  const writeText = (text: string, options: PDFKit.Mixins.TextOptions = {}) => {
    document.font('Helvetica').fontSize(10);
    const height = document.heightOfString(text, { width: 499, ...options });
    ensureSpace(height + 8);
    document.fillColor('#313A34').text(text, 48, y, { width: 499, ...options });
    y += height + 8;
  };
  const writeLabeledText = (label: string, text: string) => {
    document.font('Helvetica').fontSize(10);
    const height = document.heightOfString(text, { width: 499 });
    ensureSpace(22 + height + 8);
    section(document, label, y);
    y += 22;
    document.fillColor('#313A34').text(text, 48, y, { width: 499 });
    y += height + 8;
  };

  addPage();
  writeSection('Cliente');
  writeText([proposal.customer.name, proposal.customer.phone, proposal.customer.email].filter(Boolean).join('\n'));

  if (proposal.event) {
    writeSection('Evento');
    writeText(`${eventTypeLabels[proposal.event.eventType] ?? proposal.event.eventType}\n${formatDate(proposal.event.eventDate)} às ${proposal.event.eventTime}\n${proposal.event.location} · ${proposal.guestCount ?? proposal.event.guestCount} convidados`);
  }
  if (proposal.description) { writeSection('Descrição'); writeText(proposal.description); }

  writeMenu(document, proposal.menuSelections ?? [], writeSection, writeText, ensureSpace, () => y, (next) => { y = next; });

  if (proposal.includedServices?.length) {
    writeSection('Serviços inclusos');
    writeText(proposal.includedServices.map((service) => `- ${service.description}`).join('\n'));
  }

  writeSection('Valores');
  writeText([
    `Quantidade de convidados: ${proposal.guestCount ?? proposal.event?.guestCount ?? 0}`,
    `Valor por pessoa: ${formatMoney(proposal.pricePerGuestCents ?? 0)}`,
    `Valor base: ${formatMoney(proposal.baseTotalCents ?? proposal.subtotalCents)}`,
    proposal.adjustmentCents === 0 ? null : `${proposal.adjustmentCents < 0 ? 'Desconto' : 'Acréscimo'}: ${formatMoney(proposal.adjustmentCents)}`,
    `Total final: ${formatMoney(proposal.totalCents)}`
  ].filter(Boolean).join('\n'));

  if (proposal.paymentInstallments?.length || proposal.paymentMethods?.length) {
    writeSection('Forma de pagamento');
    if (proposal.paymentInstallments?.length) {
      const installments = calculatePaymentAmounts(proposal.totalCents, proposal.paymentInstallments);
      for (const installment of installments) writeText(`${installment.percentage}% - ${installment.description} - ${formatMoney(installment.amountCents)}`);
    }
    for (const method of proposal.paymentMethods ?? []) {
      writeText([method.name, method.pixKey ? `Chave Pix: ${method.pixKey}` : null, method.instructions].filter(Boolean).join('\n'));
    }
  }

  writeLabeledText('Validade', `Esta proposta é válida até ${formatDate(proposal.validUntil)}.`);
  if (proposal.notes) writeLabeledText('Observações', proposal.notes);
  if (proposal.responsibleNameSnapshot) {
    writeLabeledText('Responsável', [proposal.responsibleNameSnapshot, proposal.responsibleTitleSnapshot].filter(Boolean).join('\n'));
  }
  document.end();
  return completion;
}

function writeMenu(
  document: PDFKit.PDFDocument,
  selections: NonNullable<PdfProposal['menuSelections']>,
  writeSection: (label: string) => void,
  writeText: (text: string, options?: PDFKit.Mixins.TextOptions) => void,
  ensureSpace: (height: number) => void,
  getY: () => number,
  setY: (value: number) => void
) {
  if (!selections.length) return;
  writeSection('Cardápio');
  for (const group of groupMenuSelections(selections)) {
    const groupHeight = measureMenuGroup(document, group);
    if (groupHeight <= 614) ensureSpace(groupHeight);

    ensureSpace(46);
    document.fillColor('#18352A').font('Helvetica-Bold').fontSize(11).text(group.name, 48, getY(), { width: 499 });
    setY(getY() + 18);

    for (const menuSection of group.sections) {
      const showSectionName = menuSection.name !== group.name;
      const sectionHeight = measureMenuSection(document, menuSection, showSectionName);
      if (sectionHeight <= 614) ensureSpace(sectionHeight);
      if (showSectionName) {
        document.fillColor('#5C665E').font('Helvetica-Bold').fontSize(9).text(menuSection.name, 48, getY(), { width: 499 });
        setY(getY() + 16);
      }
      for (const option of menuSection.options) writeText(`- ${option.name}`);
    }
  }
}

type MenuGroup = {
  name: string;
  position: number;
  sections: Array<{ name: string; position: number; options: Array<{ name: string; position: number }> }>;
};

function groupMenuSelections(selections: NonNullable<PdfProposal['menuSelections']>): MenuGroup[] {
  const groups = new Map<string, MenuGroup>();
  for (const selection of selections) {
    const groupKey = `${selection.groupPosition}:${selection.groupName}`;
    const group = groups.get(groupKey) ?? { name: selection.groupName, position: selection.groupPosition, sections: [] };
    let menuSection = group.sections.find((item) => item.position === selection.sectionPosition && item.name === selection.sectionName);
    if (!menuSection) {
      menuSection = { name: selection.sectionName, position: selection.sectionPosition, options: [] };
      group.sections.push(menuSection);
    }
    menuSection.options.push({ name: selection.optionName, position: selection.optionPosition });
    groups.set(groupKey, group);
  }
  return [...groups.values()]
    .sort((left, right) => left.position - right.position)
    .map((group) => ({
      ...group,
      sections: group.sections
        .sort((left, right) => left.position - right.position)
        .map((menuSection) => ({ ...menuSection, options: menuSection.options.sort((left, right) => left.position - right.position) }))
    }));
}

function measureMenuGroup(document: PDFKit.PDFDocument, group: MenuGroup) {
  return 18 + group.sections.reduce(
    (height, menuSection) => height + measureMenuSection(document, menuSection, menuSection.name !== group.name),
    0
  );
}

function measureMenuSection(document: PDFKit.PDFDocument, menuSection: MenuGroup['sections'][number], showName: boolean) {
  document.font('Helvetica').fontSize(10);
  return (showName ? 16 : 0) + menuSection.options.reduce(
    (height, option) => height + document.heightOfString(`- ${option.name}`, { width: 499 }) + 8,
    0
  );
}

function renderItemizedPdf(proposal: PdfProposal, logo: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48, compress: false, info: { Title: 'Proposta Comercial - Paladar Buffet' } });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.image(logo, 48, 44, { fit: [120, 54] });
    document.fillColor('#18352A').fontSize(20).font('Helvetica-Bold').text('Proposta Comercial', 280, 50, { width: 267, align: 'right', lineBreak: false });
    document.fillColor('#5C665E').fontSize(9).font('Helvetica').text(`Emitida em ${formatDate(proposal.createdAt)}`, 280, 80, { width: 267, align: 'right', lineBreak: false });
    document.text(`Status: ${statusLabels[proposal.status] ?? proposal.status}`, 280, 96, { width: 267, align: 'right', lineBreak: false });
    line(document, 118);
    section(document, 'Paladar Buffet', 134);
    document.fillColor('#313A34').fontSize(10).font('Helvetica').text('Brasília/DF e região\nAtendimento personalizado para eventos e celebrações.', 48, 152);
    section(document, 'Cliente', 200);
    document.fillColor('#313A34').fontSize(10).font('Helvetica').text([proposal.customer.name, proposal.customer.phone, proposal.customer.email].filter(Boolean).join('\n'), 48, 218);

    let cursor = 274;
    if (proposal.event) {
      section(document, 'Evento', cursor);
      document.fillColor('#313A34').fontSize(10).font('Helvetica').text(`${eventTypeLabels[proposal.event.eventType] ?? proposal.event.eventType}\n${formatDate(proposal.event.eventDate)} às ${proposal.event.eventTime}\n${proposal.event.location} · ${proposal.event.guestCount} convidados`, 48, cursor + 18);
      cursor += 82;
    }
    if (proposal.description) { section(document, 'Descrição', cursor); document.fillColor('#313A34').fontSize(10).font('Helvetica').text(proposal.description, 48, cursor + 18, { width: 500 }); cursor += 54; }

    let y = itemTableHeader(document, cursor, 'Itens e serviços');
    document.font('Helvetica').fillColor('#313A34').fontSize(9);
    for (const item of proposal.items) {
      const rowHeight = Math.max(20, Math.ceil(document.heightOfString(item.description, { width: 265 })) + 6);
      if (y + rowHeight > 710) {
        document.addPage(); y = itemTableHeader(document, 48, 'Itens e serviços (continuação)');
        document.font('Helvetica').fillColor('#313A34').fontSize(9);
      }
      document.text(item.description, 48, y, { width: 265 }).text(String(item.quantity), 325, y, { width: 45, align: 'right' }).text(formatMoney(item.unitPriceCents), 380, y, { width: 72, align: 'right' }).text(formatMoney(item.subtotalCents), 462, y, { width: 84, align: 'right' });
      y += rowHeight;
    }
    if (y + 130 > 730) { document.addPage(); y = 48; }
    line(document, y + 2); y += 12;
    document.font('Helvetica').text('Subtotal', 380, y, { width: 72, align: 'right' }).text(formatMoney(proposal.subtotalCents), 462, y, { width: 84, align: 'right' }); y += 18;
    document.text(proposal.adjustmentCents < 0 ? 'Desconto' : 'Acréscimo', 380, y, { width: 72, align: 'right' }).text(formatMoney(proposal.adjustmentCents), 462, y, { width: 84, align: 'right' }); y += 22;
    document.fillColor('#18352A').font('Helvetica-Bold').fontSize(12).text('Total final', 355, y, { width: 97, align: 'right' }).text(formatMoney(proposal.totalCents), 462, y, { width: 84, align: 'right' }); y += 38;
    section(document, 'Validade', y);
    document.fillColor('#313A34').font('Helvetica').fontSize(10).text(`Esta proposta é válida até ${formatDate(proposal.validUntil)}.`, 48, y + 18);
    if (proposal.notes) { y += 56; section(document, 'Observações', y); document.fillColor('#313A34').font('Helvetica').fontSize(10).text(proposal.notes, 48, y + 18, { width: 500 }); }
    document.fillColor('#5C665E').fontSize(8).font('Helvetica').text('Paladar Buffet - Proposta comercial', 48, 770, { width: 500, align: 'center' });
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
