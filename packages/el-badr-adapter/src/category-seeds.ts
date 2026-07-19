export interface CategorySeed {
  id: string;
  name: string;
  /** Full category path relative to domain root, e.g. 'index.php?route=product/category&path=107_20' */
  url: string;
  enabled?: boolean;
}

/**
 * El Badr Group category seeds derived from the store's product category hierarchy.
 * Pilot: CPU only.
 */
export const EL_BADR_CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    id: 'cpu',
    name: 'CPU',
    url: 'cpu',
  },
];

export function getAllCategorySeeds(): CategorySeed[] {
  return [...EL_BADR_CATEGORY_SEEDS];
}

export function getCategorySeedById(id: string): CategorySeed | undefined {
  return EL_BADR_CATEGORY_SEEDS.find((category) => category.id === id);
}
