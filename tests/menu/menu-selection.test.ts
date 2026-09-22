import { describe, expect, it } from 'vitest';
import { validateMenuSelections, type SelectableMenuGroup } from '../../src/modules/menu/menu-selection.js';

const catalog: SelectableMenuGroup[] = [
  {
    id: 'group-sides',
    name: 'Acompanhamentos',
    position: 3,
    minSelections: 3,
    maxSelections: 3,
    isActive: true,
    sections: [
      {
        id: 'section-rice',
        name: 'Arroz',
        position: 1,
        isActive: true,
        options: [
          { id: 'rice-white', name: 'Arroz branco', position: 1, isActive: true },
          { id: 'rice-broccoli', name: 'Arroz com brócolis', position: 2, isActive: true }
        ]
      },
      {
        id: 'section-pasta',
        name: 'Massas',
        position: 2,
        isActive: true,
        options: [
          { id: 'pasta-penne', name: 'Penne ao molho quatro queijos', position: 1, isActive: true },
          { id: 'pasta-fettuccine', name: 'Fettucine ao molho branco', position: 2, isActive: false }
        ]
      }
    ]
  },
  {
    id: 'group-drinks',
    name: 'Bebidas',
    position: 6,
    minSelections: 0,
    maxSelections: null,
    isActive: true,
    sections: [
      {
        id: 'section-drinks',
        name: 'Bebidas',
        position: 1,
        isActive: true,
        options: [{ id: 'drink-water', name: 'Água', position: 1, isActive: true }]
      }
    ]
  }
];

describe('validateMenuSelections', () => {
  it('counts selections from Arroz and Massas against the same group limit and creates snapshots', () => {
    const mutableCatalog = structuredClone(catalog);
    const snapshots = validateMenuSelections(mutableCatalog, ['rice-white', 'rice-broccoli', 'pasta-penne', 'drink-water']);

    expect(snapshots).toEqual([
      {
        menuOptionId: 'rice-white',
        groupName: 'Acompanhamentos',
        groupPosition: 3,
        sectionName: 'Arroz',
        sectionPosition: 1,
        optionName: 'Arroz branco',
        optionPosition: 1
      },
      {
        menuOptionId: 'rice-broccoli',
        groupName: 'Acompanhamentos',
        groupPosition: 3,
        sectionName: 'Arroz',
        sectionPosition: 1,
        optionName: 'Arroz com brócolis',
        optionPosition: 2
      },
      {
        menuOptionId: 'pasta-penne',
        groupName: 'Acompanhamentos',
        groupPosition: 3,
        sectionName: 'Massas',
        sectionPosition: 2,
        optionName: 'Penne ao molho quatro queijos',
        optionPosition: 1
      },
      {
        menuOptionId: 'drink-water',
        groupName: 'Bebidas',
        groupPosition: 6,
        sectionName: 'Bebidas',
        sectionPosition: 1,
        optionName: 'Água',
        optionPosition: 1
      }
    ]);

    mutableCatalog[0].name = 'Acompanhamentos atualizados';
    mutableCatalog[0].sections[0].options[0].name = 'Arroz renomeado';
    expect(snapshots[0]).toMatchObject({ groupName: 'Acompanhamentos', optionName: 'Arroz branco' });
  });

  it.each([
    [['rice-white', 'pasta-penne'], 'Selecione exatamente 3 opções em Acompanhamentos.'],
    [['rice-white', 'rice-broccoli', 'pasta-penne', 'drink-water', 'drink-water'], 'Não repita opções do cardápio.'],
    [['rice-white', 'rice-broccoli', 'pasta-fettuccine'], 'Uma opção selecionada não está disponível.'],
    [['rice-white', 'rice-broccoli', 'unknown-option'], 'Uma opção selecionada não está disponível.']
  ])('rejects an invalid selection', (selectedIds, message) => {
    expect(() => validateMenuSelections(catalog, selectedIds)).toThrow(message);
  });
});
