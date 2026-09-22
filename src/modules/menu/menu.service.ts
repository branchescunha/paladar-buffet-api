import type { MenuGroupInput, MenuOptionInput, MenuSectionInput } from './menu.schemas.js';
import type { SelectableMenuGroup } from './menu-selection.js';

export interface MenuService {
  getPublicCatalog(): Promise<SelectableMenuGroup[]>;
  getAdminCatalog(): Promise<SelectableMenuGroup[]>;
  createGroup(input: MenuGroupInput): Promise<unknown>;
  updateGroup(id: string, input: MenuGroupInput): Promise<unknown | null>;
  deleteGroup(id: string): Promise<boolean>;
  createSection(input: MenuSectionInput): Promise<unknown>;
  updateSection(id: string, input: MenuSectionInput): Promise<unknown | null>;
  deleteSection(id: string): Promise<boolean>;
  createOption(input: MenuOptionInput): Promise<unknown>;
  updateOption(id: string, input: MenuOptionInput): Promise<unknown | null>;
  deleteOption(id: string): Promise<boolean>;
}
