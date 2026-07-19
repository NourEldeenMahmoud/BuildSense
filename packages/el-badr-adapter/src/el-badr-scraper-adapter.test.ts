import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ElBadrScraperAdapter } from './el-badr-scraper-adapter.js';

const BASE_URL = 'https://elbadrgroupeg.store';

function loadFixture(name: string): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-badr/product-pages',
    name,
  );
  return readFileSync(fixturePath, 'utf-8');
}

function loadCategoryFixture(): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-badr/category-pages/cpu-category.html',
  );
  return readFileSync(fixturePath, 'utf-8');
}

describe('ElBadrScraperAdapter', () => {
  const adapter = new ElBadrScraperAdapter(BASE_URL);

  it('has correct store code', () => {
    expect(adapter.storeCode).toBe('EL_BADR');
  });

  it('has parser version', () => {
    expect(adapter.parserVersion).toBe('0.1.0');
  });

  describe('getSeedRequests', () => {
    it('returns seed requests for CPU category', () => {
      const seeds = adapter.getSeedRequests();
      expect(seeds.length).toBe(1);
      expect(seeds[0]!.url).toContain('elbadrgroupeg.store');
      expect(seeds[0]!.userData.label).toBe('CATEGORY_PAGE');
      expect(seeds[0]!.userData.categoryHint).toBe('cpu');
    });
  });

  describe('parseCategoryPage', () => {
    it('parses the CPU category fixture', async () => {
      const html = loadCategoryFixture();
      const result = await adapter.parseCategoryPage({
        url: 'https://elbadrgroupeg.store/cpu',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.products.length).toBeGreaterThanOrEqual(10);
      expect(result.pagination.isNext).toBe(true);
    });
  });

  describe('parseProductPage', () => {
    it('parses Ryzen 5 8600G (product ID 7543)', async () => {
      const html = loadFixture('amd-ryzen-5-8600g-tray.html');
      const result = await adapter.parseProductPage({
        url: 'https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.externalId).toBe('7543');
      expect(result.raw.title).toContain('8600G');
      expect(result.raw.priceText).toBe('8299');
      expect(result.raw.modelText).toBe('Ryzen 5 8600G Tray Desktop Processor');
      expect(result.raw.partNumberText).toBe('100-000001237');
      expect(result.raw.availabilityText).toBe('In Stock');
      expect(result.raw.brandText).toBe('amd');
      expect(result.raw.specifications.length).toBeGreaterThan(0);
      const specLabels = result.raw.specifications.map((s) => s.label);
      expect(specLabels).toContain('Architecture');
    });

    it('parses Ryzen 7 5700 (product ID 7542)', async () => {
      const html = loadFixture('amd-ryzen-7-5700-tray.html');
      const result = await adapter.parseProductPage({
        url: 'https://elbadrgroupeg.store/amd-ryzen-7-5700-tray-8-core-zen-3-processor',
        html,
        scrapeRunId: 'test-run',
      });

      expect(result.externalId).toBe('7542');
      expect(result.raw.priceText).toBe('6750');
      expect(result.raw.modelText).toBe('Ryzen 7 5700 (Tray)');
      expect(result.raw.partNumberText).toBe('100-000000743');
      expect(result.raw.availabilityText).toBe('In Stock');
    });

    it('has storeCode EL_BADR in adapter', () => {
      expect(adapter.storeCode).toBe('EL_BADR');
    });

    it('injects CPU category evidence into raw breadcrumbs', async () => {
      const html = loadFixture('amd-ryzen-5-8600g-tray.html');
      const result = await adapter.parseProductPage({
        url: 'https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor',
        html,
        scrapeRunId: 'test-run',
      });

      // The adapter is CPU-only so it injects 'CPU' at position 0 of raw breadcrumbs
      expect(result.raw.breadcrumbs.length).toBeGreaterThan(0);
      expect(result.raw.breadcrumbs[0]).toBe('CPU');
    });
  });

  describe('extractExternalId', () => {
    it('extracts product ID from HTML', () => {
      const url = new URL('https://elbadrgroupeg.store/test-product');
      const html = '<input name="product_id" value="7543">';
      const result = adapter.extractExternalId(url, html);
      expect(result).toBe('7543');
    });

    it('extracts product ID from data attribute', () => {
      const url = new URL('https://elbadrgroupeg.store/test-product');
      const html = '<div data-product-id="7543">';
      const result = adapter.extractExternalId(url, html);
      expect(result).toBe('7543');
    });
  });

  describe('classifyHttpFailure', () => {
    it('delegates to failure classifier', () => {
      const result = adapter.classifyHttpFailure({ httpStatus: 429 });
      expect(result).toBe('HTTP_429');
    });
  });

  describe('isValidOrigin', () => {
    it('validates store host', () => {
      expect(adapter.isValidOrigin(new URL('https://elbadrgroupeg.store/cpu'))).toBe(true);
      expect(adapter.isValidOrigin(new URL('https://evil.com/steal'))).toBe(false);
    });
  });
});
