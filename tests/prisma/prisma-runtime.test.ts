import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adapterConstructor: vi.fn(),
  prismaConstructor: vi.fn()
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class PrismaPg {
    constructor(config: unknown) {
      mocks.adapterConstructor(config);
    }
  }
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    constructor(options: unknown) {
      mocks.prismaConstructor(options);
    }
  }
}));

describe('Prisma runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.adapterConstructor.mockReset();
    mocks.prismaConstructor.mockReset();
    delete (globalThis as { prisma?: unknown }).prisma;
  });

  it('constructs the singleton with the PostgreSQL driver adapter and runtime URL', async () => {
    const firstImport = await import('../../src/lib/prisma.js');
    const secondImport = await import('../../src/lib/prisma.js');

    expect(mocks.adapterConstructor).toHaveBeenCalledOnce();
    expect(mocks.adapterConstructor).toHaveBeenCalledWith({ connectionString: process.env.DATABASE_URL });
    expect(mocks.prismaConstructor).toHaveBeenCalledOnce();
    expect(mocks.prismaConstructor).toHaveBeenCalledWith({ adapter: expect.anything() });
    expect(secondImport.prisma).toBe(firstImport.prisma);
  });
});
