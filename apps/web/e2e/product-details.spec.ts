import { test, expect, type Page } from '@playwright/test';

// --- Fixture data ---
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
  title: 'Dual Offer CPU',
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

const PRODUCT_NULL_OFFER = {
  ...PRODUCT_DETAIL,
  id: '64a00000000000000000null',
  title: 'Empty Product',
  offers: [],
  images: [],
  rawSpecifications: [],
};

const PRODUCT_NULL_PRICE = {
  ...PRODUCT_DETAIL,
  id: '64a00000000000000000np',
  title: 'Null Price Product',
  offers: [
    {
      id: 'offer-null-price',
      storeCode: 'SIGMA',
      price: null,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://www.sigma-computer.com/item?id=np',
    },
  ],
};

const PRODUCT_SPARSE = {
  ...PRODUCT_DETAIL,
  id: '64a00000000000000000sparse',
  title: 'Sparse Product',
  brand: null,
  model: null,
  mpn: null,
  images: [],
  rawSpecifications: [],
  offers: [],
};

const API_BASE = 'http://localhost:3000';

/**
 * Set up API route mocks. Uses URL predicate for robust matching
 * regardless of base URL or query parameters.
 *
 * Also suppresses the /api/health check from the header so unmatched
 * requests don't hit a dead port.
 */
async function setupDetailMocks(
  page: Page,
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

  // Mock the detail endpoint using URL predicate
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

test.describe('Product Details — Stage 5', () => {
  test.describe('Complete Product', () => {
    test('loads and displays product detail with title, price, availability', async ({
      page,
    }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      await expect(page.locator('h1.product-title')).toContainText(
        'Intel Core i7-13700K Processor'
      );
      await expect(page.locator('.current-price')).toContainText('25,000');
      await expect(page.locator('.current-price')).toContainText('EGP');
      await expect(page.locator('.status-indicator')).toContainText('In stock');
    });

    test('shows breadcrumb navigation', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      const breadcrumb = page.locator('.breadcrumb');
      await expect(breadcrumb).toContainText('Home');
      await expect(breadcrumb).toContainText('CPU');
    });

    test('shows safe external source link', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      const link = page.locator('.source-link');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('href', /sigma-computer\.com/);
    });

    test('shows gallery with thumbnails when multiple images', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      const thumbnails = page.locator('.gallery-thumb');
      await expect(thumbnails).toHaveCount(3);
    });

    test('shows MPN and model metadata', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      await expect(page.locator('.product-mpn')).toContainText(
        'MPN: BX8071513700K'
      );
      await expect(page.locator('.product-model')).toContainText(
        'Core i7-13700K'
      );
    });

    test('shows raw specifications in order', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      const specsSection = page.locator('.specs-section');
      await expect(specsSection).toBeVisible();
      const specLabels = specsSection.locator('.spec-label');
      await expect(specLabels).toHaveCount(4);
      await expect(specLabels.nth(0)).toContainText('Cores');
      await expect(specLabels.nth(1)).toContainText('Threads');
      await expect(specLabels.nth(2)).toContainText('Base Clock');
      await expect(specLabels.nth(3)).toContainText('TDP');
    });

    test('disables Builder and Compare buttons', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      const builderBtn = page.locator('button[aria-label*="Builder"]');
      await expect(builderBtn).toBeDisabled();

      const compareBtn = page.locator('button[aria-label*="Compare"]');
      await expect(compareBtn).toBeDisabled();
    });

    test('makes exactly one detail request', async ({ page }) => {
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

      let requestCount = 0;
      await page.route(
        (url) =>
          url.href === `${API_BASE}/api/v1/products/${PRODUCT_DETAIL.id}`,
        async (route) => {
          requestCount++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(PRODUCT_DETAIL),
          });
        }
      );

      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('.product-title').waitFor();

      expect(requestCount).toBe(1);
    });

    test('does not make separate offers request', async ({ page }) => {
      let offersRequested = false;
      await page.route(
        (url) => url.href.includes('/offers'),
        async (route) => {
          offersRequested = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{"items":[]}',
          });
        }
      );
      await setupDetailMocks(page);

      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(200);

      expect(offersRequested).toBe(false);
    });
  });

  test.describe('Multiple Offers', () => {
    test('shows offers section only when multiple offers exist', async ({
      page,
    }) => {
      await setupDetailMocks(page, {
        productResponse: PRODUCT_MULTI_OFFER,
        productId: PRODUCT_MULTI_OFFER.id,
      });
      await page.goto(`/products/${PRODUCT_MULTI_OFFER.id}`);

      await expect(page.locator('.offers-section')).toBeVisible();
      await expect(page.locator('.offer-row')).toHaveCount(2);
      await expect(page.locator('.offer-store').nth(0)).toContainText('SIGMA');
      await expect(page.locator('.offer-store').nth(1)).toContainText(
        'COMPUMART'
      );
    });

    test('does not show offers section for single offer', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      await expect(page.locator('.offers-section')).not.toBeVisible();
    });
  });

  test.describe('Empty / Sparse Product', () => {
    test('shows em dash for null price', async ({ page }) => {
      await setupDetailMocks(page, {
        productResponse: PRODUCT_NULL_PRICE,
        productId: PRODUCT_NULL_PRICE.id,
      });
      await page.goto(`/products/${PRODUCT_NULL_PRICE.id}`);

      await expect(page.locator('.price-unknown')).toBeVisible();
    });

    test('shows no-image fallback', async ({ page }) => {
      await setupDetailMocks(page, {
        productResponse: PRODUCT_NULL_OFFER,
        productId: PRODUCT_NULL_OFFER.id,
      });
      await page.goto(`/products/${PRODUCT_NULL_OFFER.id}`);

      await expect(page.locator('.gallery-image-fallback')).toBeVisible();
    });

    test('shows empty specs message', async ({ page }) => {
      await setupDetailMocks(page, {
        productResponse: PRODUCT_SPARSE,
        productId: PRODUCT_SPARSE.id,
      });
      await page.goto(`/products/${PRODUCT_SPARSE.id}`);

      await expect(page.locator('.specs-empty-text')).toContainText(
        'No specifications available'
      );
    });

    test('no offers section when offers is empty', async ({ page }) => {
      await setupDetailMocks(page, {
        productResponse: PRODUCT_NULL_OFFER,
        productId: PRODUCT_NULL_OFFER.id,
      });
      await page.goto(`/products/${PRODUCT_NULL_OFFER.id}`);

      await expect(page.locator('.offers-section')).not.toBeVisible();
    });
  });

  test.describe('Error States', () => {
    test('shows 404 not-found state', async ({ page }) => {
      await setupDetailMocks(page, {
        productStatus: 404,
        productId: 'nonexistent-id',
      });
      await page.goto('/products/nonexistent-id');

      await expect(page.locator('app-error-state')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Product Not Found' })
      ).toBeVisible();
    });

    test('shows API error state with retry', async ({ page }) => {
      await setupDetailMocks(page, { productStatus: 500 });
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      await expect(page.locator('app-error-state')).toBeVisible();
      await expect(page.getByText('Error Loading Product')).toBeVisible();
      await expect(page.locator('app-error-state button')).toBeVisible();
    });

    test('retry reloads product after initial error', async ({ page }) => {
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

      let callCount = 0;
      await page.route(
        (url) =>
          url.href === `${API_BASE}/api/v1/products/${PRODUCT_DETAIL.id}`,
        async (route) => {
          callCount++;
          if (callCount === 1) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: '{"message":"Server error"}',
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(PRODUCT_DETAIL),
            });
          }
        }
      );

      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await expect(page.locator('app-error-state')).toBeVisible();

      await page.locator('app-error-state button').click();
      await expect(page.locator('h1.product-title')).toContainText(
        'Intel Core i7-13700K Processor'
      );
    });
  });

  test.describe('Invalid ID', () => {
    test('shows error for nonexistent product ID', async ({ page }) => {
      await setupDetailMocks(page, {
        productStatus: 404,
        productId: 'nonexistent-id',
      });
      await page.goto('/products/nonexistent-id');

      await expect(page.locator('app-error-state')).toBeVisible();
    });
  });

  test.describe('Rapid Route Change', () => {
    test('shows new product after navigation, no stale data', async ({
      page,
    }) => {
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

      const productB = {
        ...PRODUCT_DETAIL,
        id: 'product-b-id',
        title: 'AMD Ryzen 9 7950X',
        category: 'CPU',
      };

      await page.route(
        (url) =>
          url.href === `${API_BASE}/api/v1/products/product-a-id`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(PRODUCT_DETAIL),
          });
        }
      );
      await page.route(
        (url) =>
          url.href === `${API_BASE}/api/v1/products/product-b-id`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(productB),
          });
        }
      );

      await page.goto('/products/product-a-id');
      await expect(page.locator('h1.product-title')).toContainText(
        'Intel Core i7-13700K Processor'
      );

      await page.goto('/products/product-b-id');
      await expect(page.locator('h1.product-title')).toContainText(
        'AMD Ryzen 9 7950X'
      );
    });
  });

  test.describe('Gallery Keyboard', () => {
    test('arrow keys navigate gallery thumbnails', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);

      const firstThumb = page.locator('.gallery-thumb').first();
      await firstThumb.focus();

      await page.keyboard.press('ArrowRight');
      const secondThumb = page.locator('.gallery-thumb').nth(1);
      await expect(secondThumb).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('No Horizontal Overflow', () => {
    test('desktop page has no horizontal overflow', async ({ page }) => {
      await setupDetailMocks(page);
      await page.goto(`/products/${PRODUCT_DETAIL.id}`);
      await page.locator('.product-title').waitFor();
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          overflow: scrollWidth > docWidth + 1,
          docWidth,
          scrollWidth,
        };
      });
      expect(
        overflow.overflow,
        `Document horizontal overflow: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.docWidth}`
      ).toBe(false);
    });
  });
});
