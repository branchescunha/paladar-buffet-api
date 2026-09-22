import { Prisma, type PrismaClient } from '@prisma/client';
import { resourceConflictError } from '../../shared/errors.js';
import type { MenuGroupInput, MenuOptionInput, MenuSectionInput } from './menu.schemas.js';
import type { MenuService } from './menu.service.js';

const catalogOrder = {
  sections: {
    orderBy: { position: 'asc' as const },
    include: { options: { orderBy: { position: 'asc' as const } } }
  }
};

export class PrismaMenuService implements MenuService {
  constructor(private readonly prisma: PrismaClient) {}

  getPublicCatalog() {
    return this.prisma.menuSelectionGroup.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      include: {
        sections: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
          include: { options: { where: { isActive: true }, orderBy: { position: 'asc' } } }
        }
      }
    });
  }

  getAdminCatalog() {
    return this.prisma.menuSelectionGroup.findMany({ orderBy: { position: 'asc' }, include: catalogOrder });
  }

  createGroup(input: MenuGroupInput) {
    return this.prisma.menuSelectionGroup.create({ data: input });
  }

  async updateGroup(id: string, input: MenuGroupInput) {
    const result = await this.prisma.menuSelectionGroup.updateMany({ where: { id }, data: input });
    return result.count ? this.prisma.menuSelectionGroup.findUnique({ where: { id }, include: catalogOrder }) : null;
  }

  async deleteGroup(id: string) {
    const existing = await this.prisma.menuSelectionGroup.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return false;
    const references = await this.prisma.quoteRequestMenuSelection.count({
      where: { menuOption: { section: { groupId: id } } }
    });
    if (references) throw resourceConflictError('Este grupo possui escolhas históricas e deve ser desativado.');
    return this.deleteSafely(() => this.prisma.menuSelectionGroup.delete({ where: { id } }));
  }

  createSection(input: MenuSectionInput) {
    return this.prisma.menuSection.create({ data: input });
  }

  async updateSection(id: string, input: MenuSectionInput) {
    const result = await this.prisma.menuSection.updateMany({ where: { id }, data: input });
    return result.count ? this.prisma.menuSection.findUnique({ where: { id }, include: { options: { orderBy: { position: 'asc' } } } }) : null;
  }

  async deleteSection(id: string) {
    const existing = await this.prisma.menuSection.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return false;
    const references = await this.prisma.quoteRequestMenuSelection.count({ where: { menuOption: { sectionId: id } } });
    if (references) throw resourceConflictError('Esta seção possui escolhas históricas e deve ser desativada.');
    return this.deleteSafely(() => this.prisma.menuSection.delete({ where: { id } }));
  }

  createOption(input: MenuOptionInput) {
    return this.prisma.menuOption.create({ data: input });
  }

  async updateOption(id: string, input: MenuOptionInput) {
    const result = await this.prisma.menuOption.updateMany({ where: { id }, data: input });
    return result.count ? this.prisma.menuOption.findUnique({ where: { id } }) : null;
  }

  async deleteOption(id: string) {
    const existing = await this.prisma.menuOption.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return false;
    const references = await this.prisma.quoteRequestMenuSelection.count({ where: { menuOptionId: id } });
    if (references) throw resourceConflictError('Esta opção possui escolhas históricas e deve ser desativada.');
    return this.deleteSafely(() => this.prisma.menuOption.delete({ where: { id } }));
  }

  private async deleteSafely(action: () => Promise<unknown>) {
    try {
      await action();
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return false;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw resourceConflictError('Este registro possui histórico e deve ser desativado.');
      }
      throw error;
    }
  }
}
