import { ApiError } from '../../shared/errors.js';

export interface SelectableMenuOption {
  id: string;
  name: string;
  position: number;
  isActive: boolean;
}

export interface SelectableMenuSection {
  id: string;
  name: string;
  position: number;
  isActive: boolean;
  options: SelectableMenuOption[];
}

export interface SelectableMenuGroup {
  id: string;
  name: string;
  position: number;
  minSelections: number;
  maxSelections: number | null;
  isActive: boolean;
  sections: SelectableMenuSection[];
}

export interface MenuSelectionSnapshot {
  menuOptionId: string;
  groupName: string;
  groupPosition: number;
  sectionName: string;
  sectionPosition: number;
  optionName: string;
  optionPosition: number;
}

const invalidSelection = (message: string) => new ApiError(400, message, 'INVALID_MENU_SELECTION');

export function validateMenuSelections(groups: SelectableMenuGroup[], selectedIds: string[]): MenuSelectionSnapshot[] {
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw invalidSelection('Não repita opções do cardápio.');
  }

  const activeGroups = groups.filter((group) => group.isActive);
  const optionIndex = new Map<string, { group: SelectableMenuGroup; section: SelectableMenuSection; option: SelectableMenuOption }>();

  for (const group of activeGroups) {
    for (const section of group.sections.filter((item) => item.isActive)) {
      for (const option of section.options.filter((item) => item.isActive)) {
        optionIndex.set(option.id, { group, section, option });
      }
    }
  }

  const selected = selectedIds.map((id) => {
    const match = optionIndex.get(id);
    if (!match) {
      throw invalidSelection('Uma opção selecionada não está disponível.');
    }
    return match;
  });

  for (const group of activeGroups) {
    const count = selected.filter((item) => item.group.id === group.id).length;
    assertGroupLimit(group, count);
  }

  return selected
    .sort(compareSelectionPosition)
    .map(({ group, section, option }) => ({
      menuOptionId: option.id,
      groupName: group.name,
      groupPosition: group.position,
      sectionName: section.name,
      sectionPosition: section.position,
      optionName: option.name,
      optionPosition: option.position
    }));
}

function assertGroupLimit(group: SelectableMenuGroup, count: number) {
  if (group.maxSelections !== null && group.minSelections === group.maxSelections && count !== group.minSelections) {
    throw invalidSelection(`Selecione exatamente ${group.minSelections} opções em ${group.name}.`);
  }
  if (count < group.minSelections) {
    throw invalidSelection(`Selecione pelo menos ${group.minSelections} opções em ${group.name}.`);
  }
  if (group.maxSelections !== null && count > group.maxSelections) {
    throw invalidSelection(`Selecione no máximo ${group.maxSelections} opções em ${group.name}.`);
  }
}

function compareSelectionPosition(
  left: { group: SelectableMenuGroup; section: SelectableMenuSection; option: SelectableMenuOption },
  right: { group: SelectableMenuGroup; section: SelectableMenuSection; option: SelectableMenuOption }
) {
  return left.group.position - right.group.position
    || left.section.position - right.section.position
    || left.option.position - right.option.position;
}
