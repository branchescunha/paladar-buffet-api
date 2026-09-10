import { prisma } from '../../lib/prisma.js';
import { PrismaProposalPdfService } from './prisma-proposal-pdf.service.js';
export const makeProposalPdfService = () => new PrismaProposalPdfService(prisma);
