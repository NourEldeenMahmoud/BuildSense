export interface CategorySeed {
  id: string;
  name: string;
  url: string;
  sigmaId: string;
  enabled?: boolean;
}

/**
 * Category IDs verified from the product category hierarchies captured in the
 * corresponding M1 category fixtures.
 */
export const SIGMA_CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    id: 'cpu',
    name: 'CPU',
    url: '/en/category/9f503b67-b433-4434-8879-ebd003dce713',
    sigmaId: '9f503b67-b433-4434-8879-ebd003dce713',
  },
  {
    id: 'gpu',
    name: 'Graphic Card & Accessories',
    url: '/en/category/9f503b88-167a-4e18-bdf0-5bb94c7bcdd0',
    sigmaId: '9f503b88-167a-4e18-bdf0-5bb94c7bcdd0',
  },
  {
    id: 'motherboard',
    name: 'Motherboard',
    url: '/en/category/9f503b04-6f11-402e-864c-9a3286af46ba',
    sigmaId: '9f503b04-6f11-402e-864c-9a3286af46ba',
  },
  {
    id: 'ram',
    name: 'RAM',
    url: '/en/category/9f503b76-e257-48d8-be01-c3e7154eab03',
    sigmaId: '9f503b76-e257-48d8-be01-c3e7154eab03',
  },
  {
    id: 'storage',
    name: 'Storage',
    url: '/en/category/9f5039ed-8dd4-4a9b-a8ce-caf20ed29436',
    sigmaId: '9f5039ed-8dd4-4a9b-a8ce-caf20ed29436',
  },
  {
    id: 'psu',
    name: 'Power Supply',
    url: '/en/category/9f503bb0-e2e2-482c-9a6a-ac15542abcb1',
    sigmaId: '9f503bb0-e2e2-482c-9a6a-ac15542abcb1',
  },
  {
    id: 'case',
    name: 'Case',
    url: '/en/category/9f503ba3-42e3-449f-bdb8-0e687118860d',
    sigmaId: '9f503ba3-42e3-449f-bdb8-0e687118860d',
  },
  {
    id: 'cooling',
    name: 'Cooling',
    url: '/en/category/9f503b96-3738-4a0b-9038-4dc7298f9c97',
    sigmaId: '9f503b96-3738-4a0b-9038-4dc7298f9c97',
  },
  {
    id: 'bundles',
    name: 'Bundles',
    url: '/en/category/9f83a3f5-420b-424c-a522-6f8eeee34fc6',
    sigmaId: '9f83a3f5-420b-424c-a522-6f8eeee34fc6',
  },
];

export function getAllCategorySeeds(): CategorySeed[] {
  return [...SIGMA_CATEGORY_SEEDS];
}

export function getCategorySeedById(id: string): CategorySeed | undefined {
  return SIGMA_CATEGORY_SEEDS.find((category) => category.id === id);
}

export function getCategorySeedBySigmaId(sigmaId: string): CategorySeed | undefined {
  return SIGMA_CATEGORY_SEEDS.find((category) => category.sigmaId === sigmaId);
}
