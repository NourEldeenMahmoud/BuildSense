import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

/** Valid 24-char hex IDs that are distinct. */
const LEFT_ID = '64a1b2c3d4e5f60718293a01';
const RIGHT_ID = '64a1b2c3d4e5f60718293a02';

const LEFT_PRODUCT = {
  id: LEFT_ID,
  title: 'Intel Core i7-13700K Processor',
  category: 'CPU',
  brand: 'Intel',
  model: 'Core i7-13700K',
  mpn: 'BX8071513700K',
  images: ['https://img.example.com/front.jpg'],
  rawSpecifications: [{ label: 'Cores', value: '16' }],
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
  rawSpecifications: [{ label: 'Cores', value: '8' }],
  offers: [{
    id: 'offer-right',
    storeCode: 'SIGMA',
    price: 22000,
    currency: 'EGP',
    availability: 'IN_STOCK',
    sourceUrl: 'https://www.sigma-computer.com/item?id=2',
  }],
};

async function mockHealthAndDetails(
  page: import('@playwright/test').Page,
  options: { leftProduct?: unknown; rightProduct?: unknown; leftStatus?: number; rightStatus?: number } = {}
) {
  await page.route(
    (url) => url.href.startsWith(`${API_BASE}/api/health`),
    async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' })
  );
  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${LEFT_ID}`,
    async (route) => {
      if (options.leftStatus) {
        await route.fulfill({ status: options.leftStatus, contentType: 'application/json', body: '{"message":"Error"}' });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.leftProduct ?? LEFT_PRODUCT) });
      }
    }
  );
  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${RIGHT_ID}`,
    async (route) => {
      if (options.rightStatus) {
        await route.fulfill({ status: options.rightStatus, contentType: 'application/json', body: '{"message":"Error"}' });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.rightProduct ?? RIGHT_PRODUCT) });
      }
    }
  );
}

test.describe('Compare Routing', () => {
  test('renders MISSING_IDS when no params are provided', async ({ page }) => {
    // Assert no catalog API calls
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/products') || url.includes('/api/v1/categories')) {
        expect(false).toBeTruthy(); // Fail if catalog request is made
      }
    });

    await page.goto('/compare');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Missing Products')).toBeVisible();
  });

  test('renders MISSING_IDS when one param is missing', async ({ page }) => {
    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Missing Products')).toBeVisible();
  });

  test('renders MALFORMED_LEFT when left ID is invalid', async ({ page }) => {
    await page.goto('/compare?left=invalid_id_length&right=5f9b3b3b3b3b3b3b3b3b3b3b');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Invalid Left Product')).toBeVisible();
  });

  test('renders MALFORMED_RIGHT when right ID is invalid', async ({ page }) => {
    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=short');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Invalid Right Product')).toBeVisible();
  });

  test('renders DUPLICATE_IDS when both IDs are identical (same case)', async ({ page }) => {
    await page.goto('/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=5f9b3b3b3b3b3b3b3b3b3b3b');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Duplicate Products')).toBeVisible();
  });

  test('renders DUPLICATE_IDS when both IDs are identical (different case)', async ({ page }) => {
    await page.goto('/compare?left=64ABCDEF1234567890ABCDEF&right=64abcdef1234567890abcdef');
    await expect(page.locator('app-error-state')).toBeVisible();
    await expect(page.getByText('Duplicate Products')).toBeVisible();
  });

  test('valid state makes exactly two detail requests and renders comparison', async ({ page }) => {
    let detailRequestCount = 0;
    await mockHealthAndDetails(page);

    page.on('request', (request) => {
      const url = request.url();
      if (url.match(/\/api\/v1\/products\/[0-9a-fA-F]{24}(\?|$)/)) {
        detailRequestCount++;
      }
    });

    await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
    await expect(page.locator('h1.compare-heading')).toBeVisible();
    await expect(page.locator('bs-compare-headers')).toBeVisible();
    await expect(page.locator('bs-compare-spec-matrix')).toBeVisible();
    expect(detailRequestCount).toBe(2);
  });

  test('error states do not make detail API requests', async ({ page }) => {
    let detailRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().match(/\/api\/v1\/products\/[0-9a-fA-F]{24}(\?|$)/)) {
        detailRequestCount++;
      }
    });

    await page.goto('/compare');
    await expect(page.locator('app-error-state')).toBeVisible();
    expect(detailRequestCount).toBe(0);
  });
});
