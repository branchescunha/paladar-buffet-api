import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.DEV_ADMIN_PASSWORD;
const name = process.env.DEV_ADMIN_NAME ?? 'Paladar Admin';
const googleId = process.env.DEV_ADMIN_GOOGLE_ID?.trim() || null;

async function main() {
  if (!email || !password) {
    console.info('Skipping seed. Set DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD for local development.');
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash, googleId, isActive: true },
    create: { name, email, passwordHash, googleId, role: 'ADMIN' }
  });

  console.info(`Development admin ensured for ${email}.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
