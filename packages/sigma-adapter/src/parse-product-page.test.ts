import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProductPage } from './parse-product-page.js';

const FIXTURES = resolve(import.meta.dirname ?? '.', '../../../fixtures/sigma');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), 'utf-8');
}

describe('parseProductPage', () => {
  it('parses AMD Ryzen 7 9700X product page', () => {
    const html = loadFixture('product-pages/amd-ryzen-7-9700x.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.name).toContain('9700X');
    expect(result!.product.price.current).toBe(14999);
    expect(result!.product.price.currency).toBe('EGP');
    expect(result!.product.sku).toBeTruthy();
    expect(result!.product.brand?.name).toBe('AMD');
    expect(result!.product.is_stock).toBe(true);
  });

  it('extracts specifications from product page', () => {
    const html = loadFixture('product-pages/amd-ryzen-7-9700x.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    const specs = result!.product.specifications;
    expect(specs.length).toBeGreaterThan(0);

    const specNames = specs.map((s) => s.name);
    expect(specNames).toContain('Series');
    expect(specNames).toContain('CPU Socket');
    expect(specNames).toContain('Total Cores');
    expect(specNames).toContain('TDP');
    expect(specNames).toContain('Memory Types');
  });

  it('parses GPU product page (MSI RTX 3050)', () => {
    const html = loadFixture('product-pages/msi-rtx-3050-ventus-2x.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.name).toContain('RTX 3050');
    expect(result!.product.brand?.name).toBe('MSI');
    expect(result!.product.price.current).toBe(14799);

    const specNames = result!.product.specifications.map((s) => s.name);
    expect(specNames).toContain('GPU');
    expect(specNames).toContain('Memory Size');
    expect(specNames).toContain('Memory Type');
    expect(specNames).toContain('CUDA Cores');
    expect(specNames).toContain('Recommended PSU');
  });

  it('parses MSI RTX 5070 product page', () => {
    const html = loadFixture('product-pages/msi-rtx-5070-shadow-2x.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.brand?.name).toBe('MSI');
    expect(result!.product.specifications.length).toBeGreaterThan(0);
  });

  it('parses motherboard product page', () => {
    const html = loadFixture('product-pages/msi-mag-b850m-mortar-wifi.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.specifications.length).toBeGreaterThan(0);

    const specNames = result!.product.specifications.map((s) => s.name);
    expect(specNames).toContain('Model');
    expect(specNames).toContain('Chipset');
  });

  it('parses RAM product page', () => {
    const html = loadFixture('product-pages/klevv-bolt-v-32gb-ddr5-6400.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.specifications.length).toBeGreaterThan(0);
  });

  it('parses storage product page', () => {
    const html = loadFixture('product-pages/transcend-esd310-512gb.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.name.toLowerCase()).toContain('transcend');
    expect(result!.product.brand?.name).toBe('Transcend');
    expect(result!.product.price.current).toBe(4499);
    expect(result!.product.specifications).toEqual([]);
  });

  it('parses PSU product page', () => {
    const html = loadFixture('product-pages/seasonic-core-gc-850.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.specifications.length).toBeGreaterThan(0);
  });

  it('parses case product page', () => {
    const html = loadFixture('product-pages/aerocool-p500d.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.specifications.length).toBeGreaterThan(0);
  });

  it('parses CPU cooler product page', () => {
    const html = loadFixture('product-pages/id-cooling-frozn-a620.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.specifications.length).toBeGreaterThan(0);
  });

  it('parses bundle component specifications', () => {
    const html = loadFixture('product-pages/intel-ultra-5-225f-bundle.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.category.name).toBe('Bundles');
    expect(result!.product.specifications.map((specification) => specification.name)).toEqual([
      'CPU',
      'GPU',
      'Motherboard',
      'RAM',
      'SSD',
      'Cooler',
      'Case (Includes PSU)',
    ]);
  });

  it('preserves unavailable stock and discounted pricing', () => {
    const html = loadFixture('product-pages/intel-core-i5-13400f-out-of-stock.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product).toMatchObject({
      name: expect.stringContaining('i5-13400F'),
      is_stock: false,
      is_discount: true,
      price: { base: 6999.99, current: 6599, discount_percentage: 5, currency: 'EGP' },
    });
  });

  it('preserves source variant attributes', () => {
    const html = loadFixture('product-pages/acer-predator-gp30-2tb-variant.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product).toMatchObject({
      brand: { name: 'ACER' },
      variant_attributes: { capacity: '2TB' },
      sub_products: [],
    });
  });

  it('returns null for empty/invalid HTML', () => {
    const result = parseProductPage('<html><body></body></html>');
    expect(result).toBeNull();
  });

  it('rejects a product candidate with missing required fields', () => {
    const html = `<script>self.__next_f.push([1,{"id":"product-id","slug":"product-slug","name":"Incomplete","specifications":[]}])</script>`;

    expect(parseProductPage(html)).toBeNull();
  });

  it('extracts category hierarchy from product page', () => {
    const html = loadFixture('product-pages/amd-ryzen-7-9700x.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.category.name).toBeTruthy();
    expect(result!.product.category.parent_category).toBeDefined();
    expect(result!.breadcrumb).toEqual(
      expect.arrayContaining([
        { level: 1, label: 'Home', href: '/' },
        {
          level: 3,
          label: 'AMD CPU',
          href: '/en/category/9f515a41-d376-43a2-8ca4-f03d250abfb8',
        },
      ]),
    );
  });

  it('extracts brand information from product page', () => {
    const html = loadFixture('product-pages/amd-ryzen-7-9700x.html');
    const result = parseProductPage(html);

    expect(result).not.toBeNull();
    expect(result!.product.brand?.name).toBe('AMD');
    expect(result!.product.brand?.id).toBe('9f4a03fa-f526-4842-8832-151ebc7e934b');
  });
});
