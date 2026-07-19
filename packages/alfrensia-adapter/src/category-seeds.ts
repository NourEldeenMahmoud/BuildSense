export interface CategorySeed {
  id: string;
  name: string;
  /** Full category path relative to domain root, e.g. 'product-category/monitors/' */
  url: string;
  enabled?: boolean;
}

/**
 * Alfrensia category seeds derived from the store's product category hierarchy.
 * Covers all known PC-component categories + monitors.
 */
export const ALFRENSIA_CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    id: 'processor',
    name: 'Processor',
    url: 'product-category/processor/',
  },
  {
    id: 'graphics-card',
    name: 'Graphics Card',
    url: 'product-category/graphics-card/',
  },
  {
    id: 'motherboard',
    name: 'Motherboard',
    url: 'product-category/motherboard/',
  },
  {
    id: 'ram',
    name: 'RAM',
    url: 'product-category/ram/',
  },
  {
    id: 'power-supply',
    name: 'Power Supply',
    url: 'product-category/power-supply/',
  },
  {
    id: 'cases',
    name: 'Cases',
    url: 'product-category/cases/',
  },
  {
    id: 'air-liquid-cooling',
    name: 'Air & Liquid Cooling',
    url: 'product-category/air-liquid-cooling/',
  },
  {
    id: 'case-fans',
    name: 'Case Fans',
    url: 'product-category/case-fans/',
  },
  {
    id: 'monitors',
    name: 'Monitors',
    url: 'product-category/monitors/',
  },
];

export function getAllCategorySeeds(): CategorySeed[] {
  return [...ALFRENSIA_CATEGORY_SEEDS];
}

export function getCategorySeedById(id: string): CategorySeed | undefined {
  return ALFRENSIA_CATEGORY_SEEDS.find((category) => category.id === id);
}
