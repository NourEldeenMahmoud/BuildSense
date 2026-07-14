import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SigmaScraperAdapter } from './sigma-scraper-adapter.js';

const FIXTURES = resolve(import.meta.dirname ?? '.', '../../../fixtures/sigma');
const BASE_URL = 'https://www.sigma-computer.com';

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), 'utf-8');
}

describe('SigmaScraperAdapter', () => {
  describe('getSeedRequests', () => {
    it('returns only enabled category seeds', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const requests = adapter.getSeedRequests();

      expect(requests.length).toBeGreaterThan(0);
      for (const req of requests) {
        expect(req.url).toMatch(/^https:\/\/www\.sigma-computer\.com\/en\/category\//);
        expect(req.userData.label).toBe('CATEGORY_PAGE');
      }
    });

    it('includes category hint in userData', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const requests = adapter.getSeedRequests();
      const cpuSeed = requests.find(
        (r) => r.userData.categoryHint === 'cpu',
      );

      expect(cpuSeed).toBeDefined();
      expect(cpuSeed!.url).toContain(
        '9f503b67-b433-4434-8879-ebd003dce713',
      );
    });
  });

  describe('parseCategoryPage', () => {
    it('constructs canonical URLs as /en/item?id=<slug>', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const html = loadFixture('category-pages/gpu-category.html');

      return adapter.parseCategoryPage({
        url: `${BASE_URL}/en/category/9f503b88-167a-4e18-bdf0-5bb94c7bcdd0`,
        html,
        scrapeRunId: 'test-run',
      }).then((result) => {
        for (const product of result.products) {
          expect(product.canonicalUrl).toMatch(
            /^https:\/\/www\.sigma-computer\.com\/en\/item\?id=/,
          );
          expect(product.canonicalUrl).not.toMatch(
            /\/en\/item\/[a-z0-9-]+$/i,
          );
        }
      });
    });

    it('preserves product identity fields', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const html = loadFixture('category-pages/gpu-category.html');

      return adapter.parseCategoryPage({
        url: `${BASE_URL}/en/category/9f503b88-167a-4e18-bdf0-5bb94c7bcdd0`,
        html,
        scrapeRunId: 'test-run',
      }).then((result) => {
        expect(result.products.length).toBeGreaterThan(0);
        for (const product of result.products) {
          expect(product.canonicalUrl).toBeTruthy();
          expect(product.name).toBeTruthy();
        }
      });
    });
  });

  describe('parseProductPage', () => {
    it('parses valid product page', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const html = loadFixture('product-pages/amd-ryzen-7-9700x.html');

      return adapter.parseProductPage({
        url: `${BASE_URL}/en/item?id=test-product`,
        html,
        scrapeRunId: 'test-run',
      }).then((result) => {
        expect(result.externalId).toBeTruthy();
        expect(result.raw.title).toContain('9700X');
        expect(result.warnings).toHaveLength(0);
      });
    });

    it('throws on invalid/empty HTML', async () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);

      await expect(
        adapter.parseProductPage({
          url: `${BASE_URL}/en/item?id=test-product`,
          html: '<html><body></body></html>',
          scrapeRunId: 'test-run',
        }),
      ).rejects.toThrow('PARSE_FAILED');
    });

    it('throws on malformed RSC data', async () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const html = `<script>self.__next_f.push([1,{"id":"product-id","slug":"product-slug","name":"Incomplete","specifications":[]}])</script>`;

      await expect(
        adapter.parseProductPage({
          url: `${BASE_URL}/en/item?id=test-product`,
          html,
          scrapeRunId: 'test-run',
        }),
      ).rejects.toThrow('PARSE_FAILED');
    });
  });

  describe('isValidOrigin', () => {
    it('accepts configured Sigma origin', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      expect(adapter.isValidOrigin(new URL(`${BASE_URL}/en/item?id=test`))).toBe(true);
    });

    it('rejects off-domain URLs', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      expect(adapter.isValidOrigin(new URL('https://evil.com/phishing'))).toBe(false);
    });

    it('rejects IP-based URLs', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      expect(adapter.isValidOrigin(new URL('http://192.168.1.1/en/item?id=test'))).toBe(false);
    });
  });

  describe('extractExternalId', () => {
    it('returns URL id parameter for product URLs', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const url = new URL(`${BASE_URL}/en/item?id=abc-123-slug`);
      expect(adapter.extractExternalId(url)).toBe('abc-123-slug');
    });

    it('returns category UUID for category URLs', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const url = new URL(`${BASE_URL}/en/category/9f503b67-b433-4434-8879-ebd003dce713`);
      expect(adapter.extractExternalId(url)).toBe(
        '9f503b67-b433-4434-8879-ebd003dce713',
      );
    });

    it('returns null for non-Sigma URLs', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      const url = new URL('https://example.com/some-page');
      expect(adapter.extractExternalId(url)).toBeNull();
    });
  });

  describe('classifyHttpFailure', () => {
    it('delegates to Sigma failure classifier', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      expect(adapter.classifyHttpFailure({ httpStatus: 403 })).toBe('BLOCKED_RESPONSE');
      expect(adapter.classifyHttpFailure({ httpStatus: 429 })).toBe('HTTP_429');
      expect(adapter.classifyHttpFailure({ httpStatus: 500 })).toBe('HTTP_5XX');
    });
  });

  describe('metadata', () => {
    it('exposes store code', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      expect(adapter.storeCode).toBe('SIGMA');
    });

    it('exposes parser version', () => {
      const adapter = new SigmaScraperAdapter(BASE_URL);
      expect(adapter.parserVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
