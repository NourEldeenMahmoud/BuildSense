import { test, expect } from '@playwright/test';

/**
 * Stage 4 — Real Catalog Screen Visual Screenshots
 *
 * Output directory: apps/web/e2e-visual/screenshots/
 * All generated .png files are gitignored outside the source tree.
 */

// Helpers to create deterministic fixture data
const CATEGORIES_RESPONSE = { items: ['CPU', 'GPU', 'RAM', 'Storage', 'Motherboard', 'PSU'] };

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: '64a00000000000000' + String(12345),
  title: 'Intel Core i7-13700K',
  category: 'CPU',
  brand: 'Intel',
  model: 'Core i7-13700K',
  mpn: 'BX8071513700K',
  images: [],
  price: 25000,
  currency: 'EGP',
  availability: 'IN_STOCK',
  sourceUrl: 'https://www.sigma-computer.com/item?id=123',
  createdAt: '2024-01-01',
  ...overrides
});

const PRODUCTS_RESPONSE = {
  items: Array.from({ length: 24 }, (_, i) => makeProduct({
    id: '64a000000000000000000' + String(i + 1).padStart(2, '0'),
    title: `Product ${i + 1} - Gaming PC Component`,
    category: ['CPU', 'GPU', 'RAM', 'Storage', 'Motherboard', 'PSU'][i % 6],
    brand: ['Intel', 'AMD', 'NVIDIA', 'Corsair', 'ASUS', 'Seasonic'][i % 6],
    price: 1000 + i * 500
  })),
  pagination: { page: 1, pageSize: 24, totalItems: 24, totalPages: 1 }
};

const EMPTY_PRODUCTS_RESPONSE = {
  items: [],
  pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 }
};

async function setupMocks(page: import('@playwright/test').Page, options: {
  productsResponse?: unknown;
  productsStatus?: number;
} = {}) {
  await page.route('**/api/v1/categories', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATEGORIES_RESPONSE) });
  });
  await page.route('**/api/v1/products**', async route => {
    if (options.productsStatus && options.productsStatus >= 400) {
      await route.fulfill({ status: options.productsStatus, contentType: 'application/json', body: '{"message":"Server error"}' });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.productsResponse ?? PRODUCTS_RESPONSE) });
    }
  });
}

const SCREENSHOT_DIR = 'e2e-visual/screenshots';

test.describe('Stage 4 — Catalog Visual Screenshots', () => {
  /**
   * Assert the document itself does not cause horizontal overflow.
   * Uses scrollWidth vs clientWidth to allow designed scrollable containers
   * (e.g. category ribbon with overflow-x:auto) while catching true layout overflow.
   */
  async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
    const overflow = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      return { overflow: scrollWidth > docWidth + 1, docWidth, scrollWidth };
    });
    expect(overflow.overflow, `Document horizontal overflow: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.docWidth}`).toBe(false);
  }
  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('default catalog with products', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      await page.waitForTimeout(300); // Let images settle
      await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop-default-1280.png`, fullPage: true });
    });

    test('catalog with active filters applied', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/?category=GPU&brand=NVIDIA&sort=price_asc&minPrice=1000&maxPrice=50000');
      await page.locator('[data-testid="product-grid"]').waitFor();
      await page.waitForTimeout(300);
      await expect(page.locator('app-catalog-active-filters')).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop-active-filters-1280.png`, fullPage: true });
    });

    test('loading state (skeleton)', async ({ page }) => {
      // Delay API response to capture skeleton
      await page.route('**/api/v1/categories', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATEGORIES_RESPONSE) });
      });
      await page.route('**/api/v1/products**', async route => {
        await new Promise(r => setTimeout(r, 2000)); // Slow response
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS_RESPONSE) });
      });
      await page.goto('/');
      // Capture before products load
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop-loading-1280.png`, fullPage: true });
    });

    test('empty state (no products match)', async ({ page }) => {
      await setupMocks(page, { productsResponse: EMPTY_PRODUCTS_RESPONSE });
      await page.goto('/');
      await expect(page.locator('app-empty-state')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop-empty-1280.png`, fullPage: true });
    });

    test('error state (API failure)', async ({ page }) => {
      await setupMocks(page, { productsStatus: 500 });
      await page.goto('/');
      await expect(page.locator('app-error-state')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/desktop-error-1280.png`, fullPage: true });
    });
  });

  test.describe('Mobile (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('default catalog viewport', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-default-390.png`, fullPage: true });
    });

    test('mobile filter drawer open', async ({ page }) => {
      // Override: make the mobile filter toggle open the overlay
      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      // On mobile (390px), the filter toggle should open the overlay drawer
      const filterToggle = page.getByRole('button', { name: /Filters/ });
      await filterToggle.click();
      // Wait for overlay to appear
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-filter-drawer-390.png`, fullPage: true });
    });
  });
});
