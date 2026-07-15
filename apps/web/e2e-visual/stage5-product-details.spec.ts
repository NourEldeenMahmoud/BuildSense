import { test, expect } from '@playwright/test';

/**
 * Stage 5 — Product Details Visual Screenshots
 *
 * Output directory: apps/web/e2e-visual/screenshots/
 * All generated .png files are gitignored outside the source tree.
 */

const API_BASE = 'http://localhost:3000';

const PRODUCT_DETAIL = {
  id: '64a00000000000000000abc',
  title: 'Intel Core i7-13700K Processor',
  category: 'CPU',
  brand: 'Intel',
  model: 'Core i7-13700K',
  mpn: 'BX8071513700K',
  images: [
    'https://img.example.com/front.jpg',
    'https://img.example.com/back.jpg',
    'https://img.example.com/side.jpg',
  ],
  rawSpecifications: [
    { label: 'Cores', value: '16' },
    { label: 'Threads', value: '24' },
    { label: 'Base Clock', value: '3.4 GHz' },
    { label: 'TDP', value: '125W' },
    { label: 'Architecture', value: 'Raptor Lake' },
  ],
  compatibility: {},
  createdAt: '2024-01-01',
  offers: [
    {
      id: 'offer-1',
      storeCode: 'SIGMA',
      price: 25000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://www.sigma-computer.com/item?id=123',
    },
  ],
};

const PRODUCT_MULTI_OFFER = {
  ...PRODUCT_DETAIL,
  id: '64a00000000000000000def',
  offers: [
    {
      id: 'offer-a',
      storeCode: 'SIGMA',
      price: 25000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://www.sigma-computer.com/item?id=123',
    },
    {
      id: 'offer-b',
      storeCode: 'COMPUMART',
      price: 27500,
      currency: 'EGP',
      availability: 'OUT_OF_STOCK',
      sourceUrl: 'https://compumart.com/item/456',
    },
  ],
};

const PRODUCT_SPARSE = {
  ...PRODUCT_DETAIL,
  id: '64a00000000000000000null',
  brand: null,
  model: null,
  mpn: null,
  images: [],
  rawSpecifications: [],
  offers: [],
};

async function setupMocks(
  page: import('@playwright/test').Page,
  options: {
    productResponse?: unknown;
    productStatus?: number;
    productId?: string;
  } = {}
) {
  const productId = options.productId || PRODUCT_DETAIL.id;

  // Suppress the health-check probe from the header so it never hits port 3000
  await page.route(
    (url) => url.href.startsWith(`${API_BASE}/api/health`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: 'connected' }),
      });
    }
  );

  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${productId}`,
    async (route) => {
      if (options.productStatus) {
        await route.fulfill({
          status: options.productStatus,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Error' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.productResponse ?? PRODUCT_DETAIL),
      });
    }
  );
}

const SCREENSHOT_DIR = 'e2e-visual/screenshots';

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page
): Promise<void> {
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    return { overflow: scrollWidth > docWidth + 1, docWidth, scrollWidth };
  });
  expect(
    overflow.overflow,
    `Document horizontal overflow: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.docWidth}`
  ).toBe(false);
}

test.describe('Stage 5 — Product Details Visual Screenshots', () => {
  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('complete product detail', async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-product-detail-1280.png`,
        fullPage: true,
      });
    });

    test('multi-offer product', async ({ page }) => {
      await setupMocks(page, {
        productResponse: PRODUCT_MULTI_OFFER,
        productId: PRODUCT_MULTI_OFFER.id,
      });
      await page.goto(`/products/${PRODUCT_MULTI_OFFER.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-product-multi-offer-1280.png`,
        fullPage: true,
      });
    });

    test('sparse product with no images', async ({ page }) => {
      await setupMocks(page, {
        productResponse: PRODUCT_SPARSE,
        productId: PRODUCT_SPARSE.id,
      });
      await page.goto(`/products/${PRODUCT_SPARSE.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-product-sparse-1280.png`,
        fullPage: true,
      });
    });

    test('loading state', async ({ page }) => {
      // Suppress health-check so it doesn't hit a dead port
      await page.route(
        (url) => url.href.startsWith(`${API_BASE}/api/health`),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ok', database: 'connected' }),
          });
        }
      );

      await page.route(
        (url) => url.href.startsWith(`${API_BASE}/api/v1/products/`),
        async (route) => {
          await new Promise((r) => setTimeout(r, 2000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(PRODUCT_DETAIL),
          });
        }
      );
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-product-loading-1280.png`,
        fullPage: true,
      });
    });

    test('404 not found state', async ({ page }) => {
      await setupMocks(page, { productStatus: 404 });
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('app-error-state').waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-product-notfound-1280.png`,
        fullPage: true,
      });
    });

    test('API error state', async ({ page }) => {
      await setupMocks(page, { productStatus: 500 });
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('app-error-state').waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-product-error-1280.png`,
        fullPage: true,
      });
    });
  });

  test.describe('Mobile (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('complete product detail mobile', async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-product-detail-390.png`,
        fullPage: true,
      });
    });

    test('sparse product mobile', async ({ page }) => {
      await setupMocks(page, {
        productResponse: PRODUCT_SPARSE,
        productId: PRODUCT_SPARSE.id,
      });
      await page.goto(`/products/${PRODUCT_SPARSE.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-product-sparse-390.png`,
        fullPage: true,
      });
    });
  });
});
