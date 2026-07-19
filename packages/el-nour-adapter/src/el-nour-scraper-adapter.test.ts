import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ElNourScraperAdapter } from './el-nour-scraper-adapter.js';

const BASE_URL = 'https://elnour-tech.com';

function loadFixture(name: string): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-nour/product-pages',
    name,
  );
  return readFileSync(fixturePath, 'utf-8');
}

function loadCategoryFixture(): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-nour/category-pages/processors-category.html',
  );
  return readFileSync(fixturePath, 'utf-8');
}

describe('ElNourScraperAdapter', () => {
  const adapter = new ElNourScraperAdapter(BASE_URL);

  it('has correct store code', () => {
    expect(adapter.storeCode).toBe('EL_NOUR');
  });

  it('has parser version', () => {
    expect(adapter.parserVersion).toBe('0.1.0');
  });

  describe('getSeedRequests', () => {
    it('returns seed requests for all enabled categories', () => {
      const seeds = adapter.getSeedRequests();
      expect(seeds.length).toBeGreaterThan(0);
      for (const seed of seeds) {
        expect(seed.url).toContain('elnour-tech.com/en/product-category/');
        expect(seed.userData.label).toBe('CATEGORY_PAGE');
      }
    });
  });

  describe('parseCategoryPage', () => {
    it('parses the processors category fixture', async () => {
      const html = loadCategoryFixture();
      const result = await adapter.parseCategoryPage({
        url: 'https://elnour-tech.com/en/product-category/pc-parts/processors/',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.products.length).toBeGreaterThan(0);
      expect(result.pagination.isNext).toBe(true);
    });
  });

  describe('parseProductPage', () => {
    it('parses an in-stock simple product', async () => {
      const html = loadFixture('amd-ryzen-5-3400g-instock.html');
      const result = await adapter.parseProductPage({
        url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3400g-processor/',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.externalId).toBe('42241');
      expect(result.raw.title).toContain('AMD Ryzen 5 3400G');
      expect(result.raw.priceText).toBe('3499.00');
      expect(result.raw.skuText).toBe('1841');
      // SKU must not be promoted to partNumber/MPN
      expect(result.raw.partNumberText).toBeNull();
      // Specifications from WooCommerce attribute table
      expect(result.raw.specifications.length).toBeGreaterThanOrEqual(3);
      const specLabels = result.raw.specifications.map((s) => s.label);
      expect(specLabels).toContain('CPU Series');
      expect(specLabels).toContain('العلامه التجاريه');
    });

    it('parses an out-of-stock product', async () => {
      const html = loadFixture('amd-ryzen-5-3600-box-outofstock.html');
      const result = await adapter.parseProductPage({
        url: 'https://elnour-tech.com/en/product/amd-ryzen-5-3600-box/',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.externalId).toBe('12071');
      expect(result.raw.title).toContain('Ryzen™ 5 3600');
      expect(result.raw.priceText).toBe('3899.00');
      // SKU must not be promoted to partNumber/MPN
      expect(result.raw.partNumberText).toBeNull();
      // Specifications from WooCommerce attribute table
      expect(result.raw.specifications.length).toBeGreaterThanOrEqual(3);
      const specLabels = result.raw.specifications.map((s) => s.label);
      expect(specLabels).toContain('CPU Series');
    });

    it('parses a variable product', async () => {
      const html = loadFixture('intel-i5-12400f-variable.html');
      const result = await adapter.parseProductPage({
        url: 'https://elnour-tech.com/en/product/intel-core-i5-12400f-processor-6-core-12-thread-up-to-4-4ghz-lga1700/',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.externalId).toBe('19181');
      expect(result.raw.title).toContain('i5-12400F');
      // Variable product must NOT publish a price — user must select a variant
      expect(result.raw.priceText).toBeNull();
      expect(result.warnings).toContain('VARIABLE_PRICE_REQUIRES_VARIANT_SELECTION');
      // Specifications must be populated from WooCommerce attribute table
      expect(result.raw.specifications.length).toBeGreaterThanOrEqual(3);
      const specLabels = result.raw.specifications.map((s) => s.label);
      expect(specLabels).toContain('CPU Series');
      expect(specLabels).toContain('CPU Generation');
    });
  });

  describe('extractExternalId', () => {
    it('extracts category slug from category URL', () => {
      const url = new URL('https://elnour-tech.com/en/product-category/pc-parts/processors/');
      const result = adapter.extractExternalId(url);
      expect(result).toBe('pc-parts/processors');
    });

    it('extracts product ID from HTML body class', () => {
      const url = new URL('https://elnour-tech.com/en/product/test/');
      const html = '<body class="postid-42241">';
      const result = adapter.extractExternalId(url, html);
      expect(result).toBe('42241');
    });
  });

  describe('classifyHttpFailure', () => {
    it('delegates to failure classifier', () => {
      const result = adapter.classifyHttpFailure({ httpStatus: 429 });
      expect(result).toBe('HTTP_429');
    });
  });
});
