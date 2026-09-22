import { prisma } from '../../lib/prisma.js';
import { PrismaMenuService } from './prisma-menu.service.js';

export const makeMenuService = () => new PrismaMenuService(prisma);
