import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AuthService } from './auth.service.js';
import { ResendEmailSender } from './email.sender.js';
import { JoseGoogleIdentityVerifier } from './google.verifier.js';
import {
  PrismaAdminRepository,
  PrismaAuditRepository,
  PrismaPasswordResetRepository,
  PrismaSessionRepository
} from './prisma-auth.repositories.js';

export function makeAuthService() {
  return new AuthService({
    admins: new PrismaAdminRepository(prisma),
    sessions: new PrismaSessionRepository(prisma),
    passwordResets: new PrismaPasswordResetRepository(prisma),
    audit: new PrismaAuditRepository(prisma),
    emailSender: new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM),
    googleVerifier: new JoseGoogleIdentityVerifier(env.GOOGLE_CLIENT_ID),
    webUrl: env.WEB_URL
  });
}
