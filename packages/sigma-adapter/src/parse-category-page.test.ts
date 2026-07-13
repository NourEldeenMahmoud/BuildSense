import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIGMA_CATEGORY_SEEDS } from './category-seeds.js';
import { parseCategoryPage } from './parse-category-page.js';
import type { SigmaCategoryRef } from './types.js';

const FIXTURES = resolve(import.meta.dirname ?? '.', '../../../fixtures/sigma');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), 'utf-8');
}

function collectCategoryIds(category: SigmaCategoryRef): string[] {
  const ids = [category.id];
  let parent = category.parent_category;
  while (parent) {
    ids.push(parent.id);
    parent = parent.parent_category;
  }
  return ids;
}

const categoryFixtures = [
  ['bundles', 'Bundles', 'INTEL Ultra 5-225F'],
  ['case', 'Case', 'Aerocool P500D'],
  ['cooling', 'Cooling', 'ID-COOLING FROZN A620'],
  ['cpu', 'CPU', 'AMD RYZEN 7-9700X'],
  ['gpu', 'Graphic Card & Accessories', 'MSI RTX 3050'],
  ['motherboard', 'Motherboard', 'MSI AMD MAG B850M'],
  ['psu', 'Power Supply', 'SEASONIC Core GC-850'],
  ['ram', 'RAM', 'KLEVV Bolt V 32GB'],
  ['storage', 'Storage', 'TRANSCEND ESD310'],
] as const;

describe('parseCategoryPage', () => {
  it.each(categoryFixtures)(
    'parses the %s category fixture',
    (categoryId, displayName, firstProductName) => {
      const html = loadFixture(`category-pages/${categoryId}-category.html`);
      const parsed = parseCategoryPage(html);
      const seed = SIGMA_CATEGORY_SEEDS.find((category) => category.id === categoryId);
      const slugs = parsed.products.map((product) => product.slug);

      expect(seed).toBeDefined();
      if (!seed) throw new Error(`Missing category seed for ${categoryId}`);

      expect(parsed.products).toHaveLength(16);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(parsed.products[0]).toMatchObject({
        price: { currency: 'EGP' },
        is_stock: expect.any(Boolean),
      });
      expect(parsed.products[0]!.name).toContain(firstProductName);
      expect(parsed.products[0]!.price.current).toBeGreaterThan(0);
      expect(parsed.breadcrumb.at(-1)?.label).toBe(displayName);
      expect(
        parsed.products.some(
          (product) =>
            product.category !== null &&
            collectCategoryIds(product.category).includes(seed.sigmaId),
        ),
      ).toBe(true);
      expect(seed.url).toBe(`/en/category/${seed.sigmaId}`);
    },
  );

  it('extracts pagination metadata from the CPU fixture', () => {
    const parsed = parseCategoryPage(loadFixture('category-pages/cpu-category.html'));

    expect(parsed.pagination).toEqual({
      totalItems: 113,
      perPage: 16,
      isNext: true,
      isPrevious: false,
    });
  });

  it('extracts middle-page pagination metadata', () => {
    const parsed = parseCategoryPage(loadFixture('category-pages/cpu-category-page-2.html'));

    expect(parsed.products).toHaveLength(16);
    expect(parsed.pagination).toEqual({
      totalItems: 113,
      perPage: 16,
      isNext: true,
      isPrevious: true,
    });
  });

  it('extracts terminal-page pagination metadata', () => {
    const parsed = parseCategoryPage(loadFixture('category-pages/cpu-category-page-8.html'));

    expect(parsed.products).toHaveLength(1);
    expect(parsed.pagination).toEqual({
      totalItems: 113,
      perPage: 16,
      isNext: false,
      isPrevious: true,
    });
  });

  it('uses HTML product cards and deduplicates links when RSC data is absent', () => {
    const html = `
      <div class="flex flex-col">
        <a href="/en/item?id=sample-product"><img alt="Sample product"></a>
        <a href="/en/item?id=sample-product">Sample Product</a>
        <span class="font-bold">1,250 EGP</span>
      </div>
    `;

    const parsed = parseCategoryPage(html);

    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0]).toMatchObject({
      slug: 'sample-product',
      name: 'Sample Product',
      price: { base: null, current: 1250, discount_percentage: null, currency: 'EGP' },
      id: null,
      category: null,
      brand: null,
      is_stock: null,
    });
  });

  it('returns the empty fallback result for empty HTML', () => {
    expect(parseCategoryPage('')).toEqual({
      products: [],
      pagination: { totalItems: 0, perPage: 16, isNext: false, isPrevious: false },
      breadcrumb: [],
    });
  });

  it('rejects malformed RSC category products', () => {
    const html = `<script>self.__next_f.push([1,{"products":[{"slug":"incomplete"}]}])</script>`;

    expect(parseCategoryPage(html).products).toEqual([]);
  });
});
