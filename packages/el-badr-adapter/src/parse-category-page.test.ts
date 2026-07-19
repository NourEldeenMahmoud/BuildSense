import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCategoryPage } from './parse-category-page.js';

function loadCategoryFixture(): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-badr/category-pages/cpu-category.html',
  );
  return readFileSync(fixturePath, 'utf-8');
}

describe('parseCategoryPage', () => {
  const html = loadCategoryFixture();
  const result = parseCategoryPage(html);

  it('extracts exactly 12 main grid product cards', () => {
    expect(result.products.length).toBe(12);
    // Should NOT include recommendation carousel cards (16 additional)
    expect(result.products.length).toBeLessThan(28);
  });

  it('extracts canonical URLs', () => {
    for (const product of result.products) {
      expect(product.canonicalUrl).toMatch(/^https:\/\/elbadrgroupeg\.store\//);
    }
  });

  it('extracts product names', () => {
    for (const product of result.products) {
      expect(product.name.length).toBeGreaterThan(0);
    }
  });

  it('extracts external IDs (OpenCart product IDs)', () => {
    for (const product of result.products) {
      expect(product.externalId).not.toBeNull();
      expect(product.externalId).toMatch(/^\d+$/);
    }
  });

  it('finds the Ryzen 5 8600G product', () => {
    const ryzen = result.products.find((p) =>
      p.name.includes('8600G'),
    );
    expect(ryzen).toBeDefined();
    expect(ryzen!.externalId).toBe('7543');
    expect(ryzen!.canonicalUrl).toContain('amd-ryzen-5-8600g-tray-desktop-processor');
    expect(ryzen!.priceText).toContain('8,299');
  });

  it('finds the Ryzen 7 5700 product', () => {
    // Match the non-G Tray variant specifically
    const ryzen = result.products.find((p) =>
      p.canonicalUrl.includes('amd-ryzen-7-5700-tray'),
    );
    expect(ryzen).toBeDefined();
    expect(ryzen!.externalId).toBe('7542');
    expect(ryzen!.canonicalUrl).toContain('amd-ryzen-7-5700-tray-8-core-zen-3-processor');
    expect(ryzen!.priceText).toContain('6,750');
  });

  it('extracts prices in EGP', () => {
    const withPrice = result.products.filter((p) => p.priceText != null);
    expect(withPrice.length).toBeGreaterThan(0);
    for (const product of withPrice) {
      expect(product.priceText).toMatch(/[\d,]+/);
    }
  });

  it('extracts availability', () => {
    for (const product of result.products) {
      expect(product.availabilityText).not.toBeNull();
    }
  });

  it('has pagination info', () => {
    expect(result.pagination.perPage).toBeGreaterThan(0);
    expect(result.pagination.isNext).toBe(true); // 128 products, 12 per page
  });
});
