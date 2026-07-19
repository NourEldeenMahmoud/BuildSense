import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProductPage } from './parse-product-page.js';

function loadFixture(name: string): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-badr/product-pages',
    name,
  );
  return readFileSync(fixturePath, 'utf-8');
}

describe('parseProductPage', () => {
  describe('Ryzen 5 8600G Tray (product ID 7543)', () => {
    const html = loadFixture('amd-ryzen-5-8600g-tray.html');
    const result = parseProductPage(html);

    it('extracts visible title', () => {
      expect(result.visibleTitle).toContain('8600G');
    });

    it('extracts visible model', () => {
      expect(result.visibleModel).toBe('Ryzen 5 8600G Tray Desktop Processor');
    });

    it('extracts visible MPN', () => {
      expect(result.visibleMpn).toBe('100-000001237');
    });

    it('extracts visible stock', () => {
      expect(result.visibleStock).toBe('In Stock');
    });

    it('extracts OpenCart product ID', () => {
      expect(result.openCartProductId).toBe('7543');
    });

    it('extracts JSON-LD product', () => {
      expect(result.product).not.toBeNull();
      expect(result.product!.name).toContain('8600G');
    });

    it('JSON-LD has model and MPN', () => {
      expect(result.product!.model).toBe('Ryzen 5 8600G Tray Desktop Processor');
      expect(result.product!.mpn).toBe('100-000001237');
    });

    it('JSON-LD has price 8299 EGP', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer).toBeDefined();
      expect(offer!.price).toBe(8299);
      expect(offer!.priceCurrency).toBe('EGP');
    });

    it('JSON-LD has InStock availability', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer).toBeDefined();
      expect(offer!.availability).toContain('InStock');
    });

    it('extracts breadcrumbs', () => {
      expect(result.breadcrumbs.length).toBeGreaterThan(0);
    });

    it('extracts specifications from description', () => {
      expect(result.specifications.length).toBeGreaterThan(0);
      const specLabels = result.specifications.map((s) => s.label);
      expect(specLabels).toContain('Architecture');
      expect(specLabels).toContain('Cores / Threads');
    });

    it('preserves raw specification values', () => {
      const archSpec = result.specifications.find((s) => s.label === 'Architecture');
      expect(archSpec).toBeDefined();
      expect(archSpec!.value).toContain('Zen 4');
    });
  });

  describe('Ryzen 7 5700 Tray (product ID 7542)', () => {
    const html = loadFixture('amd-ryzen-7-5700-tray.html');
    const result = parseProductPage(html);

    it('extracts visible model', () => {
      expect(result.visibleModel).toBe('Ryzen 7 5700 (Tray)');
    });

    it('extracts visible MPN', () => {
      expect(result.visibleMpn).toBe('100-000000743');
    });

    it('extracts visible stock', () => {
      expect(result.visibleStock).toBe('In Stock');
    });

    it('extracts OpenCart product ID', () => {
      expect(result.openCartProductId).toBe('7542');
    });

    it('JSON-LD has price 6750 EGP', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer).toBeDefined();
      expect(offer!.price).toBe(6750);
      expect(offer!.priceCurrency).toBe('EGP');
    });

    it('JSON-LD has InStock availability', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer).toBeDefined();
      expect(offer!.availability).toContain('InStock');
    });

    it('extracts specifications', () => {
      expect(result.specifications.length).toBeGreaterThan(0);
      const specLabels = result.specifications.map((s) => s.label);
      expect(specLabels).toContain('Architecture');
    });
  });

  describe('duplicate JSON-LD nonempty precedence', () => {
    it('never overwrites non-empty with empty across multiple JSON-LD blocks', () => {
      const html = loadFixture('amd-ryzen-5-8600g-tray.html');
      const result = parseProductPage(html);
      // The product should have model and MPN from the first JSON-LD block
      // even though the second block may not have them
      expect(result.product!.model).toBeTruthy();
      expect(result.product!.mpn).toBeTruthy();
      expect(result.product!.sku).toBeTruthy();
    });
  });
});
