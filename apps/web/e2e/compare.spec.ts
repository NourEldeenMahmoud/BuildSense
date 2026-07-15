import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:3000';

/** Valid 24-char hex IDs that are distinct. */
const LEFT_ID = '64a1b2c3d4e5f60718293a01';
const RIGHT_ID = '64a1b2c3d4e5f60718293a02';
const NOT_FOUND_ID = '64a1b2c3d4e5f60718293a04';

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

const LEFT_PRODUCT_SPARSE = {
  ...LEFT_PRODUCT,
  rawSpecifications: [],
};

const RIGHT_PRODUCT_SPARSE = {
  ...RIGHT_PRODUCT,
  rawSpecifications: [],
};

// Candidate list items for selector search
const CANDIDATE_CPU_ITEMS = [
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

async function mockDetail(
  page: Page,
  id: string,
  product: unknown,
  status?: number
) {
  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${id}`,
    async (route) => {
      if (status) {
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(product),
        });
      }
    }
  );
}

/**
 * Mock the product list endpoint for candidate search.
 * Dynamically responds based on category/search/page params.
 */
async function mockCandidateSearch(
  page: Page,
  options: { items?: unknown[]; totalItems?: number } = {}
) {
  const items = options.items ?? CANDIDATE_CPU_ITEMS;
  const totalItems = options.totalItems ?? items.length;

  await page.route(
    (url) => {
      if (!url.href.startsWith(`${API_BASE}/api/v1/products`)) return false;
      // Match the list endpoint but NOT the detail endpoint (which has /products/<id>)
      const path = url.pathname;
      return path === '/api/v1/products' || path === '/api/v1/products/';
    },
    async (route) => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') ?? '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') ?? '24', 10);
      const start = (page_num - 1) * pageSize;
      const pageItems = items.slice(start, start + pageSize);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: pageItems,
          pagination: {
            page: page_num,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        }),
      });
    }
  );
}

interface DetailTracker {
  requests: string[];
}

function trackDetailRequests(page: Page): DetailTracker {
  const tracker: DetailTracker = { requests: [] };
  page.on('request', (request) => {
    const url = request.url();
    if (url.match(/\/api\/v1\/products\/[0-9a-fA-F]{24}(\?|$)/)) {
      tracker.requests.push(url);
    }
  });
  return tracker;
}

function trackListRequests(page: Page): { requests: string[] } {
  const tracker = { requests: [] as string[] };
  page.on('request', (request) => {
    const url = request.url();
    const path = new URL(url).pathname;
    if ((path === '/api/v1/products' || path === '/api/v1/products/') && !url.includes('/api/v1/products/')) {
      tracker.requests.push(url);
    }
  });
  return tracker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Compare — Functional Behavior', () => {

  // --- From Product Details ---
  test.describe('Product Details Entry', () => {
    test('Compare button opens accessible selector dialog', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();

      // Compare button is enabled (product has category)
      const compareBtn = page.getByRole('button', { name: /Compare/ });
      await expect(compareBtn).toBeEnabled();

      // Click to open selector
      await compareBtn.click();

      // Selector overlay should be visible as dialog
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('aria-label', /Select product to compare/);

      // Title should indicate Select Product B
      await expect(dialog).toContainText('Select Product B');
    });

    test('Selector shows initial search prompt with category name', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockCandidateSearch(page);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();

      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();

      await expect(page.getByText('Type to search for CPU products to compare')).toBeVisible();
    });

    test('Selecting product B navigates once to /compare?left=X&right=Y', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockCandidateSearch(page);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();

      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();

      // Wait for candidate results to load
      const resultItem = page.locator('[role="option"]').first();
      await expect(resultItem).toBeVisible();

      // Track navigations
      let navigationCount = 0;
      page.on('framenavigated', () => navigationCount++);

      // Click the first result
      await resultItem.click();

      // Should navigate to compare page
      await page.waitForURL(/\/compare\?left=.+&right=.+/);
      const url = new URL(page.url());
      expect(url.searchParams.get('left')).toBe(LEFT_ID);
      expect(url.searchParams.get('right')).toBeTruthy();
      expect(url.searchParams.get('right')).not.toBe(LEFT_ID);

      // Should be exactly one navigation
      expect(navigationCount).toBe(1);
    });

    test('No navigation occurs before product selection (typing in search)', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockCandidateSearch(page);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();

      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();

      // Type in search
      const searchInput = page.locator('input[aria-label*="Search"]');
      await searchInput.fill('ryzen');

      // Wait for debounce + search
      await page.waitForTimeout(500);

      // Should still be on product details page
      expect(page.url()).toContain(`/products/${LEFT_ID}`);
    });

    test('Escape closes selector without navigation', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockCandidateSearch(page);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();

      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();

      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();

      // Still on product details page
      expect(page.url()).toContain(`/products/${LEFT_ID}`);
    });
  });

  // --- Candidate search behavior ---
  test.describe('Candidate Search', () => {
    test('sends category, search, page, pageSize only (no unsupported keys)', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      const sentParams = new Map<string, string>();
      await page.route(
        (url) => {
          if (!url.href.startsWith(`${API_BASE}/api/v1/products`)) return false;
          const path = url.pathname;
          return path === '/api/v1/products' || path === '/api/v1/products/';
        },
        async (route) => {
          const url = new URL(route.request().url());
          url.searchParams.forEach((v, k) => sentParams.set(k, v));

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [], pagination: { page: 1, pageSize: 12, totalItems: 0, totalPages: 0 } }),
          });
        }
      );

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();
      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();
      await page.waitForTimeout(500);

      // Only valid params should be present
      expect(sentParams.has('category')).toBe(true);
      expect(sentParams.has('page')).toBe(true);
      expect(sentParams.has('pageSize')).toBe(true);
      expect(sentParams.get('category')).toBe('CPU');
      expect(sentParams.get('page')).toBe('1');
      expect(sentParams.get('pageSize')).toBe('12');

      // No unsupported params
      expect(sentParams.has('brand')).toBe(false);
      expect(sentParams.has('sort')).toBe(false);
      expect(sentParams.has('minPrice')).toBe(false);
      expect(sentParams.has('maxPrice')).toBe(false);
      expect(sentParams.has('excludeId')).toBe(false);
    });

    test('excludes slot A product from results', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      // Return items that include the LEFT_ID
      const itemsIncludingLeft = [
        {
          ...CANDIDATE_CPU_ITEMS[0],
        },
        {
          ...CANDIDATE_CPU_ITEMS[0],
          id: LEFT_ID,
          title: 'This should be excluded',
        },
      ];

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
              items: itemsIncludingLeft,
              pagination: { page: 1, pageSize: 12, totalItems: 2, totalPages: 1 },
            }),
          });
        }
      );

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();
      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();
      await page.waitForTimeout(500);

      // Should only show 1 result (slot A excluded)
      const results = page.locator('[role="option"]');
      await expect(results).toHaveCount(1);
      await expect(results.first()).toContainText('AMD Ryzen 7 7800X3D');
    });

    test('typing triggers debounced server-side search', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      const searchUrls: string[] = [];
      await page.route(
        (url) => {
          if (!url.href.startsWith(`${API_BASE}/api/v1/products`)) return false;
          const path = url.pathname;
          return path === '/api/v1/products' || path === '/api/v1/products/';
        },
        async (route) => {
          searchUrls.push(route.request().url());
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: CANDIDATE_CPU_ITEMS,
              pagination: { page: 1, pageSize: 12, totalItems: CANDIDATE_CPU_ITEMS.length, totalPages: 1 },
            }),
          });
        }
      );

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();
      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();

      // Wait for initial load
      await page.waitForTimeout(500);
      const initialCount = searchUrls.length;

      // Type a search query
      const searchInput = page.locator('input[aria-label*="Search"]');
      await searchInput.fill('7800');

      // Wait for debounce
      await page.waitForTimeout(500);

      // Should have one additional request with search param
      expect(searchUrls.length).toBeGreaterThanOrEqual(initialCount + 1);
      const lastUrl = new URL(searchUrls[searchUrls.length - 1]);
      expect(lastUrl.searchParams.get('search')).toBe('7800');
      expect(lastUrl.searchParams.get('category')).toBe('CPU');
    });

    test('server-side pagination with page and pageSize', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      const searchUrls: string[] = [];
      // 3 items, pageSize 2 → 2 pages
      const threeItems = [
        ...CANDIDATE_CPU_ITEMS,
        { ...CANDIDATE_CPU_ITEMS[0], id: '64a1b2c3d4e5f60718293a06', title: 'Intel i9-13900K' },
      ];

      await page.route(
        (url) => {
          if (!url.href.startsWith(`${API_BASE}/api/v1/products`)) return false;
          const path = url.pathname;
          return path === '/api/v1/products' || path === '/api/v1/products/';
        },
        async (route) => {
          const url = new URL(route.request().url());
          searchUrls.push(route.request().url());
          const pageNum = parseInt(url.searchParams.get('page') ?? '1', 10);
          const pageSize = parseInt(url.searchParams.get('pageSize') ?? '12', 10);
          const start = (pageNum - 1) * pageSize;
          const items = threeItems.slice(start, start + pageSize);

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items,
              pagination: { page: pageNum, pageSize, totalItems: 3, totalPages: 2 },
            }),
          });
        }
      );

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();
      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();
      await page.waitForTimeout(500);

      // Pagination should be visible
      const nextBtn = page.getByRole('button', { name: 'Next page' });
      await expect(nextBtn).toBeVisible();

      // Click next page
      await nextBtn.click();
      await page.waitForTimeout(500);

      // Verify page=2 was sent
      const lastUrl = new URL(searchUrls[searchUrls.length - 1]);
      expect(lastUrl.searchParams.get('page')).toBe('2');
    });

    test('stale search responses do not win (switchMap cancellation)', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      // Discriminate by URL content, not sequential index.
      // Angular's debounceTime(300) means the initial empty-query search may be
      // debounced away entirely when the user types before the timer fires, so
      // only ONE request reaches the handler. Using requestIndex would mislabel
      // that single request as "slow" (index=1) even though it carries the search
      // query. Instead, check the search param in the URL to decide speed.
      await page.route(
        (url) => {
          if (!url.href.startsWith(`${API_BASE}/api/v1/products`)) return false;
          const path = url.pathname;
          return path === '/api/v1/products' || path === '/api/v1/products/';
        },
        async (route) => {
          const url = new URL(route.request().url());
          const searchParam = url.searchParams.get('search');

          if (!searchParam) {
            // Empty query (initial load) — slow, stale response
            await new Promise(r => setTimeout(r, 600));
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                items: [{ ...CANDIDATE_CPU_ITEMS[0], title: 'STALE-RESULTS' }],
                pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
              }),
            });
          } else {
            // Search query — fast, correct response
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                items: CANDIDATE_CPU_ITEMS,
                pagination: { page: 1, pageSize: 12, totalItems: 2, totalPages: 1 },
              }),
            });
          }
        }
      );

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();
      await page.getByRole('button', { name: /Compare/ }).click();
      await page.locator('[role="dialog"]').waitFor();

      // Type immediately — this triggers the search query which returns fast.
      // The debounced empty-query request (if it fires at all) is slow and gets
      // cancelled by switchMap before completing.
      const searchInput = page.locator('input[aria-label*="Search"]');
      await searchInput.fill('ryzen');

      // Wait for the fast search response to render
      await expect(page.getByText('AMD Ryzen 7 7800X3D')).toBeVisible({ timeout: 5000 });

      // The stale "STALE-RESULTS" should never appear
      await expect(page.getByText('STALE-RESULTS')).not.toBeVisible();
    });
  });

  // --- Direct URL comparison ---
  test.describe('Direct URL Comparison', () => {
    test('valid shared URL loads exactly one detail request per ID and renders headers + matrix', async ({ page }) => {
      const tracker = trackDetailRequests(page);
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);

      // Wait for comparison to load
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await expect(page.locator('bs-compare-headers')).toBeVisible();
      await expect(page.locator('bs-compare-spec-matrix')).toBeVisible();

      // Exactly 2 detail requests
      expect(tracker.requests.length).toBe(2);

      // Headers show both products (scope to headers to avoid strict-mode clash with matrix column headers)
      await expect(page.locator('bs-compare-headers').getByText('Intel Core i7-13700K Processor')).toBeVisible();
      await expect(page.locator('bs-compare-headers').getByText('AMD Ryzen 7 7800X3D Processor')).toBeVisible();
    });

    test('reload re-fetches with exactly one detail request per ID', async ({ page }) => {
      const tracker = trackDetailRequests(page);
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      const countAfterFirstLoad = tracker.requests.length;
      expect(countAfterFirstLoad).toBe(2);

      // Reload
      await page.reload();
      await expect(page.locator('h1.compare-heading')).toBeVisible();

      // Exactly 2 more requests (one per ID)
      expect(tracker.requests.length).toBe(countAfterFirstLoad + 2);
    });

    test('missing single malformed duplicate URL states do not redirect', async ({ page }) => {
      const tracker = trackDetailRequests(page);
      await mockHealth(page);

      // Navigate through invalid states — none should redirect
      const invalidUrls = [
        '/compare',
        '/compare?left=abc',
        '/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=short',
        '/compare?left=5f9b3b3b3b3b3b3b3b3b3b3b&right=5f9b3b3b3b3b3b3b3b3b3b3b',
      ];

      for (const url of invalidUrls) {
        await page.goto(`http://localhost:4200${url}`);
        // Should show error state, not redirect
        await expect(page.locator('app-error-state')).toBeVisible();
        expect(tracker.requests.length).toBe(0);
      }
    });
  });

  // --- Cross-category ---
  test.describe('Cross-Category', () => {
    test('shows corrective error and no matrix for cross-category products', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT_GPU);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);

      // Should show cross-category error
      await expect(page.getByText('Cross-Category Comparison')).toBeVisible();
      await expect(page.getByText('different categories')).toBeVisible();

      // Should NOT show the spec matrix
      await expect(page.locator('bs-compare-spec-matrix')).not.toBeVisible();
    });
  });

  // --- Empty specs ---
  test.describe('Empty Specifications', () => {
    test('shows exact "No comparable specifications available" message while pair remains valid', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT_SPARSE);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT_SPARSE);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);

      // Both products should load (headers visible)
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await expect(page.getByText('Intel Core i7-13700K Processor')).toBeVisible();
      await expect(page.getByText('AMD Ryzen 7 7800X3D Processor')).toBeVisible();

      // Exact empty-specs message
      await expect(page.getByText('No comparable specifications available')).toBeVisible();

      // Matrix table should NOT be rendered
      await expect(page.locator('.matrix-table')).not.toBeVisible();
    });
  });

  // --- One-side errors ---
  test.describe('One-Side Errors', () => {
    test('left product not found shows left-specific error', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT, 404);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);

      await expect(page.getByText('Left Product Not Found')).toBeVisible();
    });

    test('right product not found shows right-specific error', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT, 404);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);

      await expect(page.getByText('Right Product Not Found')).toBeVisible();
    });

    test('left API error shows error with retry button', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT, 500);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);

      await expect(page.getByText('Error Loading Left Product')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });

    test('retry reloads both products after initial error', async ({ page }) => {
      let leftCallCount = 0;
      await mockHealth(page);

      await page.route(
        (url) => url.href === `${API_BASE}/api/v1/products/${LEFT_ID}`,
        async (route) => {
          leftCallCount++;
          if (leftCallCount === 1) {
            await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Server error"}' });
          } else {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LEFT_PRODUCT) });
          }
        }
      );
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.getByText('Error Loading Left Product')).toBeVisible();

      // Click retry
      await page.getByRole('button', { name: 'Retry' }).click();

      // Should now show comparison
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await expect(page.locator('bs-compare-headers').getByText('Intel Core i7-13700K Processor')).toBeVisible();
      expect(leftCallCount).toBe(2);
    });
  });

  // --- Builder / winner language ---
  test.describe('Builder and Winner', () => {
    test('Builder button is disabled on product details', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);

      await page.goto(`/products/${LEFT_ID}`);
      await page.locator('h1.product-title').waitFor();

      const builderBtn = page.getByRole('button', { name: /Builder/ });
      await expect(builderBtn).toBeDisabled();
    });

    test('no winner language in comparison matrix', async ({ page }) => {
      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();

      // No "winner" text anywhere in the comparison
      const bodyText = await page.locator('main.compare-page').textContent();
      expect(bodyText?.toLowerCase()).not.toContain('winner');
    });
  });

  // --- No unsupported API patterns ---
  test.describe('API Contract', () => {
    test('no separate/offers endpoint requested during comparison', async ({ page }) => {
      const offersUrls: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/offers')) {
          offersUrls.push(request.url());
        }
      });

      await mockHealth(page);
      await mockDetail(page, LEFT_ID, LEFT_PRODUCT);
      await mockDetail(page, RIGHT_ID, RIGHT_PRODUCT);

      await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
      await expect(page.locator('h1.compare-heading')).toBeVisible();
      await page.waitForTimeout(300);

      expect(offersUrls.length).toBe(0);
    });
  });
});
