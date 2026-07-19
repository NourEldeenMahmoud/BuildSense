import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProductPage } from './parse-product-page.js';

function loadFixture(name: string): string {
  const fixturePath = resolve(
    import.meta.dirname,
    '../../../fixtures/alfrensia/product-pages',
    name,
  );
  return readFileSync(fixturePath, 'utf-8');
}

describe('parseProductPage', () => {
  describe('inline synthetic tests', () => {
    it('should extract product data from JSON-LD', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Product",
                "name": "Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor",
                "url": "https://alfrensia.com/en/product/gigabyte-gs27qca-27-inch-qhd-180hz-1ms-mprt-curved-va-gaming-monitor/",
                "sku": "889523044490",
                "brand": {
                  "@type": "Brand",
                  "name": "Gigabyte"
                },
                "offers": {
                  "@type": "Offer",
                  "price": "6999",
                  "priceCurrency": "EGP",
                  "availability": "https://schema.org/InStock"
                }
              },
              {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "position": 1,
                    "item": {
                      "name": "Home",
                      "@id": "https://alfrensia.com/en/"
                    }
                  },
                  {
                    "position": 2,
                    "item": {
                      "name": "Shop",
                      "@id": "https://alfrensia.com/en/shop/"
                    }
                  }
                ]
              }
            ]
          }
          </script>
          <script type="application/ld+json">
          {
            "@type": "Product",
            "mpn": "GS27QCA",
            "gtin": "889523044490",
            "brand": {
              "@type": "Brand",
              "name": "Gigabyte"
            },
            "sku": "GS27QCA"
          }
          </script>
        </head>
        <body class="postid-135230">
          <h1 class="product_title">Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor</h1>
          <table class="woocommerce-product-attributes">
            <tr class="woocommerce-product-attributes-item">
              <th class="woocommerce-product-attributes-item__label">Screen Size</th>
              <td class="woocommerce-product-attributes-item__value">27"</td>
            </tr>
            <tr class="woocommerce-product-attributes-item">
              <th class="woocommerce-product-attributes-item__label">Resolution</th>
              <td class="woocommerce-product-attributes-item__value">2560 x 1440 (QHD)</td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const result = parseProductPage(html);

      expect(result.product).not.toBeNull();
      expect(result.product?.name).toBe('Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor');
      expect(result.product?.mpn).toBe('GS27QCA');
      expect(result.product?.gtin).toBe('889523044490');
      expect(result.wordpressPostId).toBe('135230');
      expect(result.visibleTitle).toBe('Gigabyte GS27QCA 27 Inch QHD 180Hz 1ms MPRT Curved VA Gaming Monitor');
      expect(result.mpn).toBe('GS27QCA');
      expect(result.gtin).toBe('889523044490');
      expect(result.specifications).toHaveLength(2);
      expect(result.specifications[0]).toEqual({ label: 'Screen Size', value: '27"' });
      expect(result.specifications[1]).toEqual({ label: 'Resolution', value: '2560 x 1440 (QHD)' });
      expect(result.breadcrumbs).toHaveLength(2);
      expect(result.breadcrumbs[0]).toEqual({ label: 'Home', href: 'https://alfrensia.com/en/' });
      expect(result.breadcrumbs[1]).toEqual({ label: 'Shop', href: 'https://alfrensia.com/en/shop/' });
    });

    it('should handle out-of-stock product', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Product",
            "name": "Acer KG241Q 23.6 Inch FHD 165Hz 0.5ms TN LED Gaming Monitor",
            "sku": "100-000001584",
            "brand": {
              "@type": "Brand",
              "name": "Acer"
            },
            "offers": {
              "@type": "Offer",
              "price": "1",
              "priceCurrency": "EGP",
              "availability": "https://schema.org/OutOfStock"
            }
          }
          </script>
        </head>
        <body class="postid-123456">
          <h1 class="product_title">Acer KG241Q 23.6 Inch FHD 165Hz 0.5ms TN LED Gaming Monitor</h1>
          <p class="stock out-of-stock">Out of stock</p>
        </body>
        </html>
      `;

      const result = parseProductPage(html);

      expect(result.product).not.toBeNull();
      expect(result.wordpressPostId).toBe('123456');
      expect(result.visibleStock).toBe('Out of stock');
    });
  });

  describe('Gigabyte GS27QCA (real fixture — in stock)', () => {
    const html = loadFixture('gigabyte-gs27qca.html');
    const result = parseProductPage(html);

    it('extracts JSON-LD product with name', () => {
      expect(result.product).not.toBeNull();
      expect(result.product!.name).toContain('GS27QCA');
    });

    it('extracts WordPress post ID', () => {
      expect(result.wordpressPostId).toBe('135230');
    });

    it('extracts visible title', () => {
      expect(result.visibleTitle).toBeTruthy();
      expect(result.visibleTitle!).toContain('GS27QCA');
    });

    it('extracts breadcrumbs (Home > Shop > Product)', () => {
      expect(result.breadcrumbs.length).toBeGreaterThanOrEqual(2);
      expect(result.breadcrumbs[0]!.label).toBe('Home');
      expect(result.breadcrumbs[1]!.label).toBe('Shop');
    });

    it('extracts MPN and GTIN from second JSON-LD block', () => {
      expect(result.mpn).toBeTruthy();
      expect(result.gtin).toBeTruthy();
    });

    it('extracts brand from JSON-LD', () => {
      expect(result.product!.brand).toBeDefined();
      const brandVal = result.product!.brand;
      const brand = typeof brandVal === 'string'
        ? brandVal
        : brandVal!.name;
      expect(brand).toBeTruthy();
    });

    it('extracts price from JSON-LD offers', () => {
      const offers = result.product!.offers;
      expect(offers).toBeDefined();
      const offer = Array.isArray(offers) ? offers[0]! : offers;
      expect(Number(offer!.price)).toBeGreaterThan(0);
    });

    it('extracts availability from JSON-LD offers', () => {
      const offers = result.product!.offers;
      const offer = Array.isArray(offers) ? offers[0]! : offers;
      expect(offer!.availability).toBeTruthy();
    });

    it('extracts specifications from WooCommerce attributes table', () => {
      expect(result.specifications.length).toBeGreaterThan(0);
    });
  });

  describe('Samsung S24D332H (real fixture)', () => {
    const html = loadFixture('samsung-s24d332h.html');
    const result = parseProductPage(html);

    it('extracts JSON-LD product with name', () => {
      expect(result.product).not.toBeNull();
      expect(result.product!.name).toContain('Samsung');
      expect(result.product!.name).toContain('S24D332H');
    });

    it('extracts WordPress post ID', () => {
      expect(result.wordpressPostId).toBeTruthy();
    });

    it('extracts visible title', () => {
      expect(result.visibleTitle).toBeTruthy();
      expect(result.visibleTitle!).toContain('Samsung');
    });

    it('extracts breadcrumbs', () => {
      expect(result.breadcrumbs.length).toBeGreaterThanOrEqual(2);
      expect(result.breadcrumbs[0]!.label).toBe('Home');
    });

    it('extracts price from JSON-LD offers', () => {
      const offers = result.product!.offers;
      expect(offers).toBeDefined();
      const offer = Array.isArray(offers) ? offers[0] : offers;
      expect(Number(offer!.price)).toBeGreaterThan(0);
    });

    it('extracts availability from JSON-LD offers', () => {
      const offers = result.product!.offers;
      const offer = Array.isArray(offers) ? offers[0] : offers;
      expect(offer!.availability).toBeTruthy();
    });
  });
});
