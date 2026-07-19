export interface CategorySeed {
  id: string;
  name: string;
  /** URL path relative to domain, without locale prefix. e.g. 'pc-parts/processors' */
  url: string;
  enabled?: boolean;
}

/**
 * El Nour Tech category seeds derived from the site's product-category hierarchy.
 */
export const EL_NOUR_CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    id: 'cpu',
    name: 'CPU',
    url: 'pc-parts/processors',
  },
  {
    id: 'gpu',
    name: 'Graphics Cards',
    url: 'pc-parts/graphics-cards',
  },
  {
    id: 'motherboard',
    name: 'Motherboard',
    url: 'pc-parts/motherboards',
  },
  {
    id: 'ram',
    name: 'RAM',
    url: 'pc-parts/ram',
  },
  {
    id: 'ssd',
    name: 'SSD',
    url: 'pc-parts/ssd',
  },
  {
    id: 'hdd',
    name: 'HDD',
    url: 'pc-parts/hdd',
  },
  {
    id: 'psu',
    name: 'Power Supply',
    url: 'pc-parts/power-supply',
  },
  {
    id: 'case',
    name: 'Case',
    url: 'pc-parts/pc-cases',
  },
  {
    id: 'cooling',
    name: 'Cooling',
    url: 'pc-parts/cooling',
  },
];

export function getAllCategorySeeds(): CategorySeed[] {
  return [...EL_NOUR_CATEGORY_SEEDS];
}

export function getCategorySeedById(id: string): CategorySeed | undefined {
  return EL_NOUR_CATEGORY_SEEDS.find((category) => category.id === id);
}
