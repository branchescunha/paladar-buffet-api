import { describe, expect, it, vi } from 'vitest';
import {
  OFFICIAL_ADMINS,
  provisionOfficialAdmins,
  type AdminProvisioningRepository,
  type ProvisionedAdmin
} from '../../prisma/admin-provisioning.js';

class MemoryProvisioningRepository implements AdminProvisioningRepository {
  readonly admins = new Map<string, ProvisionedAdmin>();

  async findByEmail(email: string) {
    return this.admins.get(email) ?? null;
  }

  async create(admin: ProvisionedAdmin) {
    this.admins.set(admin.email, { ...admin });
  }

  async update(email: string, changes: Partial<ProvisionedAdmin>) {
    const current = this.admins.get(email);
    if (!current) throw new Error('Admin not found');
    this.admins.set(email, { ...current, ...changes });
  }
}

describe('official admin provisioning', () => {
  it('creates the seven official active users with the correct roles and initial password requirement', async () => {
    const repository = new MemoryProvisioningRepository();
    const hashPassword = vi.fn(async (password: string) => `hash:${password}`);

    await provisionOfficialAdmins(repository, 'InitialPass123', hashPassword);

    expect(repository.admins).toHaveLength(7);
    expect(repository.admins.get('mauri.anderson.cunha@gmail.com')).toMatchObject({
      role: 'OWNER',
      isActive: true,
      mustChangePassword: true
    });
    expect([...repository.admins.values()].filter(({ role }) => role === 'ADMIN')).toHaveLength(6);
    expect(hashPassword).toHaveBeenCalledTimes(7);
  });

  it('preserves googleId and a password already changed when provisioning is rerun', async () => {
    const repository = new MemoryProvisioningRepository();
    const existing = OFFICIAL_ADMINS.find(({ email }) => email === 'andrevinicius.bc@gmail.com');
    if (!existing) throw new Error('Official admin fixture missing');
    repository.admins.set(existing.email, {
      ...existing,
      passwordHash: 'existing-hash',
      googleId: 'existing-google-sub',
      isActive: true,
      mustChangePassword: false
    });

    await provisionOfficialAdmins(repository, 'InitialPass123', async (password) => `hash:${password}`);

    expect(repository.admins.get(existing.email)).toMatchObject({
      passwordHash: 'existing-hash',
      googleId: 'existing-google-sub',
      mustChangePassword: false
    });
  });
});
