import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProductPage } from './parse-product-page.js';

function loadFixture(name: string): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/el-nour/product-pages',
    name,
  );
  return readFileSync(fixturePath, 'utf-8');
}

describe('parseProductPage', () => {
  describe('in-stock simple product (AMD Ryzen 5 3400G)', () => {
    const html = loadFixture('amd-ryzen-5-3400g-instock.html');
    const result = parseProductPage(html);

    it('extracts product from JSON-LD', () => {
      expect(result.product).not.toBeNull();
      expect(result.product!['@type']).toBe('Product');
    });

    it('extracts product name', () => {
      expect(result.product!.name).toContain('AMD Ryzen 5 3400G');
    });

    it('extracts WooCommerce product ID from body class', () => {
      expect(result.wooProductId).toBe('42241');
    });

    it('extracts SKU', () => {
      expect(result.sku).toBe('1841');
    });

    it('extracts price from offers', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer).toBeDefined();
      const priceSpec = offer!.priceSpecification?.[0];
      expect(priceSpec?.price).toBe('3499.00');
    });

    it('extracts availability as InStock', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer?.availability).toContain('InStock');
    });

    it('extracts brand name', () => {
      const brand = result.product!.brand;
      expect(brand).toBeDefined();
      if (typeof brand === 'object' && brand !== null) {
        expect(brand.name).toBeDefined();
      }
    });

    it('extracts breadcrumbs', () => {
      expect(result.breadcrumbs.length).toBeGreaterThan(0);
      const lastCrumb = result.breadcrumbs[result.breadcrumbs.length - 1];
      expect(lastCrumb?.label).toContain('AMD Ryzen 5 3400G');
    });

    it('is not a variable product', () => {
      expect(result.isVariable).toBe(false);
      expect(result.variations).toHaveLength(0);
    });

    it('extracts WooCommerce attribute specifications', () => {
      expect(result.specifications.length).toBeGreaterThanOrEqual(3);
      const labels = result.specifications.map((s) => s.label);
      expect(labels).toContain('العلامه التجاريه');
      expect(labels).toContain('CPU Series');
      expect(labels).toContain('نوع سوكيت المعالج');
      // Verify mixed Arabic/English values are preserved
      const brandSpec = result.specifications.find((s) => s.label === 'العلامه التجاريه');
      expect(brandSpec?.value).toBe('اى ام دى');
      const socketSpec = result.specifications.find((s) => s.label === 'نوع سوكيت المعالج');
      expect(socketSpec?.value).toBe('AM4');
    });
  });

  describe('out-of-stock product (AMD Ryzen 5 3600 BOX)', () => {
    const html = loadFixture('amd-ryzen-5-3600-box-outofstock.html');
    const result = parseProductPage(html);

    it('extracts product from JSON-LD', () => {
      expect(result.product).not.toBeNull();
      expect(result.product!['@type']).toBe('Product');
    });

    it('extracts product name', () => {
      expect(result.product!.name).toContain('AMD Ryzen™ 5 3600 BOX');
    });

    it('extracts WooCommerce product ID', () => {
      expect(result.wooProductId).toBe('12071');
    });

    it('extracts SKU', () => {
      expect(result.sku).toBe('569');
    });

    it('extracts price from offers', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer).toBeDefined();
      const priceSpec = offer!.priceSpecification?.[0];
      expect(priceSpec?.price).toBe('3899.00');
    });

    it('extracts availability as OutOfStock', () => {
      const offer = Array.isArray(result.product!.offers)
        ? result.product!.offers[0]
        : result.product!.offers;
      expect(offer?.availability).toContain('OutOfStock');
    });

    it('extracts WooCommerce attribute specifications', () => {
      expect(result.specifications.length).toBeGreaterThanOrEqual(3);
      const labels = result.specifications.map((s) => s.label);
      expect(labels).toContain('العلامه التجاريه');
      expect(labels).toContain('CPU Series');
      expect(labels).toContain('نوع سوكيت المعالج');
      // Verify mixed Arabic/English values are preserved
      const brandSpec = result.specifications.find((s) => s.label === 'العلامه التجاريه');
      expect(brandSpec?.value).toBe('اى ام دى');
      const seriesSpec = result.specifications.find((s) => s.label === 'CPU Series');
      expect(seriesSpec?.value).toBe('Ryzen-5');
    });
  });

  describe('variable product (Intel i5-12400F)', () => {
    const html = loadFixture('intel-i5-12400f-variable.html');
    const result = parseProductPage(html);

    it('extracts product from JSON-LD', () => {
      expect(result.product).not.toBeNull();
      expect(result.product!['@type']).toBe('Product');
    });

    it('extracts product name', () => {
      expect(result.product!.name).toContain('i5-12400F');
    });

    it('extracts WooCommerce product ID', () => {
      expect(result.wooProductId).toBe('19181');
    });

    it('extracts SKU from JSON-LD', () => {
      expect(result.sku).toBe('1976');
    });

    it('identifies as variable product', () => {
      expect(result.isVariable).toBe(true);
    });

    it('extracts product variations', () => {
      expect(result.variations.length).toBeGreaterThan(0);
    });

    it('each variation has a display_price', () => {
      for (const v of result.variations) {
        expect(typeof v.display_price).toBe('number');
        expect(v.display_price).toBeGreaterThan(0);
      }
    });

    it('variation prices match known values', () => {
      const prices = result.variations.map((v) => v.display_price);
      // Known variation prices from the fixture: 7499, 8499, 6999
      expect(prices).toContain(7499);
      expect(prices).toContain(6999);
    });

    it('extracts breadcrumbs', () => {
      expect(result.breadcrumbs.length).toBeGreaterThan(0);
    });

    it('extracts WooCommerce attribute specifications', () => {
      expect(result.specifications.length).toBeGreaterThanOrEqual(3);
      const labels = result.specifications.map((s) => s.label);
      expect(labels).toContain('العلامه التجاريه');
      expect(labels).toContain('CPU Series');
      expect(labels).toContain('CPU Generation');
      expect(labels).toContain('نوع سوكيت المعالج');
      // Verify mixed Arabic/English values are preserved
      const brandSpec = result.specifications.find((s) => s.label === 'العلامه التجاريه');
      expect(brandSpec?.value).toBe('انتل');
      const genSpec = result.specifications.find((s) => s.label === 'CPU Generation');
      expect(genSpec?.value).toBe('12th Generation');
      const socketSpec = result.specifications.find((s) => s.label === 'نوع سوكيت المعالج');
      expect(socketSpec?.value).toBe('LGA 1700');
    });
  });
});
