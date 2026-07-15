import { test, expect, type Page } from '@playwright/test';

/**
 * Stage 6 — Compare Visual Screenshots
 *
 * Output directory: apps/web/e2e-visual/screenshots/
 * All generated .png files are gitignored.
 */

const API_BASE = 'http://localhost:3000';

const LEFT_ID = '64a1b2c3d4e5f60718293a01';
const RIGHT_ID = '64a1b2c3d4e5f60718293a02';
const RIGHT_GPU_ID = '64a1b2c3d4e5f60718293a03';

const LEFT_PRODUCT = {
  id: LEFT_ID,
  title: 'Intel Core i7-13700K Processor',
  category: 'CPU',
  brand: 'Intel',
  model: 'Core i7-13700K',
  mpn: 'BX8071513700K',
  images: ['https://img.example.com/front.jpg'],
  rawSpecifications: [
    { label: 'Cores', value: '16' },
    { label: 'Threads', value: '24' },
    { label: 'Base Clock', value: '3.4 GHz' },
    { label: 'TDP', value: '125W' },
    { label: 'Architecture', value: 'Raptor Lake' },
  ],
  compatibility: {},
  createdAt: '2024-01-01',
  offers: [{
    id: 'offer-left',
    storeCode: 'SIGMA',
    price: 25000,
    currency: 'EGP',
    availability: 'IN_STOCK',
    sourceUrl: 'https://www.sigma-computer.com/item?id=1',
  }],
};

const RIGHT_PRODUCT = {
  ...LEFT_PRODUCT,
  id: RIGHT_ID,
  title: 'AMD Ryzen 7 7800X3D Processor',
  brand: 'AMD',
  model: 'Ryzen 7 7800X3D',
  mpn: '100-100000910WOF',
  rawSpecifications: [
    { label: 'Cores', value: '8' },
    { label: 'Threads', value: '16' },
    { label: 'Base Clock', value: '4.2 GHz' },
    { label: 'Boost Clock', value: '5.0 GHz' },
    { label: 'TDP', value: '120W' },
  ],
  offers: [{
    id: 'offer-right',
    storeCode: 'SIGMA',
    price: 22000,
    currency: 'EGP',
    availability: 'IN_STOCK',
    sourceUrl: 'https://www.sigma-computer.com/item?id=2',
  }],
};

const RIGHT_PRODUCT_GPU = {
  ...RIGHT_PRODUCT,
  id: RIGHT_GPU_ID,
  title: 'NVIDIA GeForce RTX 4070',
  category: 'GPU',
  brand: 'NVIDIA',
  model: 'GeForce RTX 4070',
  mpn: 'RTX-4070',
  rawSpecifications: [
    { label: 'VRAM', value: '12 GB' },
    { label: 'TDP', value: '200W' },
  ],
};

const LEFT_SPARSE = {
  ...LEFT_PRODUCT,
  rawSpecifications: [],
};

const RIGHT_SPARSE = {
  ...RIGHT_PRODUCT,
  rawSpecifications: [],
};

const CANDIDATE_ITEMS = [
  {
    id: RIGHT_ID,
    title: 'AMD Ryzen 7 7800X3D Processor',
    category: 'CPU',
    brand: 'AMD',
    model: 'Ryzen 7 7800X3D',
    mpn: '100-100000910WOF',
    images: [],
    price: 22000,
    currency: 'EGP',
    availability: 'IN_STOCK',
    sourceUrl: 'https://www.sigma-computer.com/item?id=2',
    createdAt: '2024-01-01',
  },
  {
    id: '64a1b2c3d4e5f60718293a05',
    title: 'Intel Core i5-13600K Processor',
    category: 'CPU',
    brand: 'Intel',
    model: 'Core i5-13600K',
    mpn: 'BX8071513600K',
    images: [],
    price: 18000,
    currency: 'EGP',
    availability: 'IN_STOCK',
    sourceUrl: 'https://www.sigma-computer.com/item?id=5',
    createdAt: '2024-01-01',
  },
];

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockHealth(page: Page) {
  await page.route(
    (url) => url.href.startsWith(`${API_BASE}/api/health`),
    async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', database: 'connected' }),
    })
  );
}

async function mockDetail(page: Page, id: string, product: unknown, status?: number) {
  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${id}`,
    async (route) => {
      if (status) {
        await route.fulfill({ status, contentType: 'application/json', body: '{"message":"Error"}' });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(product) });
      }
    }
  );
}

async function mockCandidateSearch(page: Page) {
  await page.route(
    (url) => {
      if (!url.href.startsWith(`${API_BASE}/api/v1/products`)) return false;
      const path = url.pathname;
      return path === '/api/v1/products' || path === '/api/v1/products/';
    },
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: CANDIDATE_ITEMS,
          pagination: { page: 1, pageSize: 12, totalItems: CANDIDATE_ITEMS.length, totalPages: 1 },
        }),
      });
    }
  );
}

const SCREENSHOT_DIR = 'e2e-visual/screenshots';

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Stage 6 — Compare Visual Screenshots', () => {

  // ===== Desktop (1280px) =====
  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('compare selector overlay from product details', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockCandidateSearch(page);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();
      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();
      await page.waitForTimeout(500);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-compare-selector-1280.png`,
        fullPage: false,
      });
    });

    test('valid populated comparison', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-compare-populated-1280.png`,
        fullPage: true,
      });
    });

    test('empty specs comparison', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_SPARSE);
      await mockDetail(page, RIGHT_ID, RIGHT_SPARSE);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-compare-empty-specs-1280.png`,
        fullPage: true,
      });
    });

    test('cross-category error state', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_GPU_ID, RIGHT_PRODUCT_GPU);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_GPU_ID}`);
      await expect(page.getByText('Cross-Category Comparison')).toBeVisible();
      await page.waitForTimeout(300);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-compare-cross-category-1280.png`,
        fullPage: true,
      });
    });

    test('loading state', async ({ page }) => {
      await mockHealth(page);

      // Slow detail responses
      await page.route(
        (url) => url.href.startsWith(`${API_BASE}/api/v1/products/`),
        async (route) => {
          await new Promise((r) => setTimeout(r, 2000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(LEFT_PRODUCT),
          });
        }
      );

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await page.waitForTimeout(500);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-compare-loading-1280.png`,
        fullPage: true,
      });
    });

    test('left not found error state', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT, 404);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.getByText('Left Product Not Found')).toBeVisible();
      await page.waitForTimeout(300);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-compare-notfound-1280.png`,
        fullPage: true,
      });
    });
  });

  // ===== Mobile (390x844) =====
  test.describe('Mobile (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('valid populated comparison mobile', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-compare-populated-390.png`,
        fullPage: true,
      });
    });

    test('empty specs comparison mobile', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_SPARSE);
      await mockDetail(page, RIGHT_ID, RIGHT_SPARSE);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-compare-empty-specs-390.png`,
        fullPage: true,
      });
    });

    test('mobile matrix scroll container is keyboard-scrollable and associated', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      // Verify matrix scroll container has accessible attributes
      const scrollContainer = page.locator('.matrix-scroll-container');
      await expect(scrollContainer).toBeVisible();
      await expect(scrollContainer).toHaveAttribute('tabindex', '0');
      await expect(scrollContainer).toHaveAttribute('role', 'region');
      await expect(scrollContainer).toHaveAttribute('aria-label', /Scrollable specification comparison table/);

      // Verify keyboard focus works
      await scrollContainer.focus();
      await expect(scrollContainer).toBeFocused();
    });

    test('desktop alignment is usable via headers grid', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      // Verify two header columns exist (grid layout)
      const headers = page.locator('.compare-header');
      await expect(headers).toHaveCount(2);

      // Verify both headers have content
      await expect(headers.nth(0).locator('.header-title')).toContainText('Intel Core i7-13700K');
      await expect(headers.nth(1).locator('.header-title')).toContainText('AMD Ryzen 7 7800X3D');
    });
  });
});
