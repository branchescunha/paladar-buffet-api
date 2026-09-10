import { prisma } from '../../lib/prisma.js';
import { PrismaProposalService } from './prisma-proposal.service.js';
export const makeProposalService = () => new PrismaProposalService(prisma);
