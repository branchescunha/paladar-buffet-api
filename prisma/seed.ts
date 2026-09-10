import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { passwordSchema } from '../src/modules/auth/password-policy.js';
import {
  OFFICIAL_ADMINS,
  provisionOfficialAdmins,
  type AdminProvisioningRepository,
  type ProvisionedAdmin
} from './admin-provisioning.js';

const prisma = new PrismaClient();

async function main() {
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    throw new Error('ADMIN_INITIAL_PASSWORD is required to provision official administrators.');
  }

  const password = passwordSchema.parse(initialPassword);
  const repository: AdminProvisioningRepository = {
    async findByEmail(email) {
      return prisma.adminUser.findUnique({ where: { email } });
    },
    async create(admin: ProvisionedAdmin & { passwordHash: string }) {
      await prisma.adminUser.create({ data: admin });
    },
    async update(email, changes) {
      await prisma.adminUser.update({ where: { email }, data: changes });
    }
  };

  await provisionOfficialAdmins(repository, password, (value) =>
    argon2.hash(value, { type: argon2.argon2id })
  );

  console.info(`Provisioned ${OFFICIAL_ADMINS.length} official administrators.`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown provisioning error.';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
