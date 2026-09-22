export type ProvisionedAdminRole = 'OWNER' | 'ADMIN';

export interface ProvisionedAdmin {
  name: string;
  email: string;
  role: ProvisionedAdminRole;
  passwordHash: string | null;
  googleId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AdminProvisioningRepository {
  findByEmail(email: string): Promise<ProvisionedAdmin | null>;
  create(admin: ProvisionedAdmin & { passwordHash: string }): Promise<void>;
  update(email: string, changes: Partial<ProvisionedAdmin>): Promise<void>;
}

export const OFFICIAL_ADMINS = [
  { name: 'Mauri Anderson Cunha', email: 'mauri.anderson.cunha@gmail.com', role: 'ADMIN' },
  { name: 'Paladar Buffet DF', email: 'paladar.buffet.df@gmail.com', role: 'ADMIN' },
  { name: 'Buffet Paladar DF', email: 'buffet.paladar.df@gmail.com', role: 'ADMIN' },
  { name: 'Churrascaria Paladar DF', email: 'churrascaria.paladar.df@gmail.com', role: 'ADMIN' },
  { name: 'Cheiro Verde Setor O', email: 'cheiroverdesetoro@gmail.com', role: 'ADMIN' },
  { name: 'Administrativo Paladar', email: 'admnistrativo.paladar@gmail.com', role: 'ADMIN' },
  { name: 'Andre Vinicius', email: 'andrevinicius.bc@gmail.com', role: 'ADMIN' }
] as const satisfies ReadonlyArray<{ name: string; email: string; role: ProvisionedAdminRole }>;

export async function provisionOfficialAdmins(
  repository: AdminProvisioningRepository,
  initialPassword: string,
  hashPassword: (password: string) => Promise<string>
) {
  for (const officialAdmin of OFFICIAL_ADMINS) {
    const existing = await repository.findByEmail(officialAdmin.email);

    if (!existing) {
      await repository.create({
        ...officialAdmin,
        passwordHash: await hashPassword(initialPassword),
        googleId: null,
        isActive: true,
        mustChangePassword: true
      });
      continue;
    }

    await repository.update(officialAdmin.email, {
      name: officialAdmin.name,
      role: officialAdmin.role,
      isActive: true,
      ...(existing.mustChangePassword ? { passwordHash: await hashPassword(initialPassword) } : {})
    });
  }
}
