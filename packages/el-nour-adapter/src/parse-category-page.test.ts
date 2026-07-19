import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCategoryPage } from './parse-category-page.js';

const FIXTURE_PATH = resolve(
  import.meta.dirname,
  '../../../fixtures/el-nour/category-pages/processors-category.html',
);

function loadFixture(): string {
  return readFileSync(FIXTURE_PATH, 'utf-8');
}

describe('parseCategoryPage', () => {
  it('extracts products from the processors category fixture', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    expect(result.products.length).toBeGreaterThan(0);
  });

  it('extracts product URLs', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    for (const product of result.products) {
      expect(product.canonicalUrl).toMatch(/elnour-tech\.com\/en\/product\//);
    }
  });

  it('extracts product names', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    for (const product of result.products) {
      expect(product.name.length).toBeGreaterThan(0);
    }
  });

  it('extracts WooCommerce product IDs as external IDs', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    // The fixture contains known products with data-id attributes
    const externalIds = result.products.map((p) => p.externalId).filter(Boolean);
    expect(externalIds.length).toBeGreaterThan(0);

    // Should contain known product IDs from the fixture
    const allIds = new Set(externalIds);
    expect(allIds.has('19181')).toBe(true); // Intel i5-12400F
    expect(allIds.has('42241')).toBe(true); // AMD Ryzen 5 3400G
    expect(allIds.has('12071')).toBe(true); // AMD Ryzen 5 3600 BOX
  });

  it('extracts price text for in-stock products', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    // Find AMD Ryzen 5 3400G (simple product with single price)
    const ryzen3400g = result.products.find((p) => p.externalId === '42241');
    expect(ryzen3400g).toBeDefined();
    expect(ryzen3400g!.priceText).not.toBeNull();
  });

  it('extracts price range for variable products', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    // Find Intel i5-12400F (variable product with price range)
    const i5_12400f = result.products.find((p) => p.externalId === '19181');
    expect(i5_12400f).toBeDefined();
    expect(i5_12400f!.priceText).toContain('–');
  });

  it('detects stock status from CSS classes', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    // Intel i5-12400F is instock
    const i5_12400f = result.products.find((p) => p.externalId === '19181');
    expect(i5_12400f).toBeDefined();
    expect(i5_12400f!.isStock).toBe(true);

    // AMD Ryzen 5 3600 BOX is outofstock
    const ryzen3600 = result.products.find((p) => p.externalId === '12071');
    expect(ryzen3600).toBeDefined();
    expect(ryzen3600!.isStock).toBe(false);
  });

  it('extracts pagination info', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    expect(result.pagination.isNext).toBe(true);
    expect(result.pagination.isPrevious).toBe(false);
    expect(result.pagination.totalItems).toBeGreaterThanOrEqual(4 * 24); // 4 pages
  });

  it('does not produce duplicate products', () => {
    const html = loadFixture();
    const result = parseCategoryPage(html);

    const ids = result.products.map((p) => p.externalId).filter(Boolean);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
