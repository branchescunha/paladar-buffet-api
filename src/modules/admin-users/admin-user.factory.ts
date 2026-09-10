import { prisma } from '../../lib/prisma.js';
import { PrismaAdminUserManagementService } from './prisma-admin-user.service.js';

export const makeAdminUserManagementService = () => new PrismaAdminUserManagementService(prisma);
