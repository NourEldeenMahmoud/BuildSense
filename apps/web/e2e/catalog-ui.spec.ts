import { test, expect, type Page } from '@playwright/test';

// --- Test Fixture Data ---
const CATEGORIES_RESPONSE = { items: ['CPU', 'GPU', 'RAM', 'Storage'] };

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

/** Deterministic fixture: 24 items for pageSize 24, totalItems 24, totalPages 1 */
const PRODUCTS_RESPONSE = {
  items: Array.from({ length: 24 }, (_, i) => makeProduct({
    id: '64a000000000000000000' + String(i + 1).padStart(2, '0'),
    title: `Product ${i + 1}`,
    category: i < 12 ? 'CPU' : 'GPU',
    brand: i < 6 ? 'Intel' : (i < 12 ? 'AMD' : 'NVIDIA'),
    price: 1000 + i * 500
  })),
  pagination: { page: 1, pageSize: 24, totalItems: 34, totalPages: 2 }
};

const PAGE2_PRODUCTS_RESPONSE = {
  items: Array.from({ length: 10 }, (_, i) => makeProduct({
    id: '64b000000000000000000' + String(i + 1).padStart(2, '0'),
    title: `Product ${i + 25}`
  })),
  pagination: { page: 2, pageSize: 24, totalItems: 34, totalPages: 2 }
};

const EMPTY_PRODUCTS_RESPONSE = {
  items: [],
  pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 }
};

/** Track product-list vs detail vs offers requests */
interface RequestTracker {
  list: string[];
  detail: string[];
  offers: string[];
}

function trackRequests(page: Page): RequestTracker {
  const tracker: RequestTracker = { list: [], detail: [], offers: [] };
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/offers')) {
      tracker.offers.push(url);
    } else if (url.match(/\/api\/v1\/products\/[^?/]+(\?|$)/) && !url.includes('/products?')) {
      tracker.detail.push(url);
    } else if (url.includes('/api/v1/products')) {
      tracker.list.push(url);
    }
  });
  return tracker;
}

/** Set up API route mocks. Products route responds dynamically to page param. */
async function setupMocks(page: Page, options: {
  productsResponse?: unknown;
  categoriesResponse?: unknown;
  productsStatus?: number;
  /** When set, routes respond with page-specific mock data */
  multiPage?: boolean;
} = {}) {
  await page.route('**/api/v1/categories', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.categoriesResponse ?? CATEGORIES_RESPONSE)
    });
  });

  await page.route('**/api/v1/products**', async route => {
    if (options.productsStatus && options.productsStatus >= 400) {
      await route.fulfill({ status: options.productsStatus, contentType: 'application/json', body: '{"message":"Server error"}' });
      return;
    }
    if (options.multiPage) {
      const url = new URL(route.request().url());
      const pageNum = parseInt(url.searchParams.get('page') ?? '1', 10);
      const resp = pageNum === 2 ? PAGE2_PRODUCTS_RESPONSE : PRODUCTS_RESPONSE;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.productsResponse ?? PRODUCTS_RESPONSE)
    });
  });
}

test.describe('Catalog UI — Stage 4', () => {
  test.describe('Default State', () => {
    test('loads home page with search bar and category ribbon', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');

      await expect(page.locator('#catalog-search-input')).toBeVisible();
      await expect(page.locator('[data-testid="category-ribbon"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Processors (CPU)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Graphics (GPU)' })).toBeVisible();
    });

    test('shows product cards after loading', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');

      await expect(page.locator('app-catalog-product-card')).toHaveCount(24);
    });

    test('shows result count', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');

      await expect(page.locator('[data-testid="result-status"]')).toContainText('1–24 of 34 products');
    });

    test('makes exactly one list request and no detail or offers requests', async ({ page }) => {
      await setupMocks(page);
      const tracker = trackRequests(page);

      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();

      // Should be exactly 1 list request, 0 detail, 0 offers
      expect(tracker.list.length).toBe(1);
      expect(tracker.detail.length).toBe(0);
      expect(tracker.offers.length).toBe(0);
    });
  });

  test.describe('Search', () => {
    test('search input updates URL with debounce and triggers exactly one new products request', async ({ page }) => {
      await setupMocks(page);
      const tracker = trackRequests(page);

      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      // Clear initial request tracking
      const initialListCount = tracker.list.length;

      await page.fill('#catalog-search-input', 'rtx');

      // Wait for debounce (300ms) + navigation + API
      await page.waitForURL(/search=rtx/);
      await page.waitForTimeout(500); // Allow API response to settle

      // URL should have search param
      expect(page.url()).toContain('search=rtx');
      // Exactly one new list request
      expect(tracker.list.length).toBe(initialListCount + 1);
      const lastUrl = new URL(tracker.list[tracker.list.length - 1]);
      expect(lastUrl.searchParams.get('search')).toBe('rtx');
      // No detail/offers
      expect(tracker.detail.length).toBe(0);
      expect(tracker.offers.length).toBe(0);
    });

    test('clear search removes search param with one navigation', async ({ page }) => {
      await setupMocks(page);
      const tracker = trackRequests(page);

      await page.goto('/?search=rtx');
      await page.locator('[data-testid="product-grid"]').waitFor();
      // Clear the initial load
      const initialCount = tracker.list.length;

      // Click clear button
      await page.locator('[data-testid="search-clear"]').click();

      await page.waitForURL(url => !url.search.includes('search'));
      await page.waitForTimeout(500);

      // One new request without search param
      expect(tracker.list.length).toBe(initialCount + 1);
    });
  });

  test.describe('Category Selection', () => {
    test('clicking a category updates URL and makes exactly one filtered request', async ({ page }) => {
      await setupMocks(page);
      const tracker = trackRequests(page);

      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      const initialCount = tracker.list.length;

      // Use exact testid selector to avoid ambiguity with active-filter chips
      await page.locator('[data-testid="category-chip-CPU"]').click();

      await page.waitForURL(/category=CPU/);
      // Wait for API response
      await page.waitForTimeout(500);

      expect(page.url()).toContain('category=CPU');
      expect(tracker.list.length).toBe(initialCount + 1);
      const lastReq = new URL(tracker.list[tracker.list.length - 1]);
      expect(lastReq.searchParams.get('category')).toBe('CPU');
    });

    test('selected category button shows as active', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/?category=GPU');

      const gpuBtn = page.locator('[data-testid="category-chip-GPU"]');
      await expect(gpuBtn).toHaveAttribute('aria-pressed', 'true');
      await expect(gpuBtn).toHaveClass(/active/);
    });
  });

  test.describe('Filters — Desktop', () => {
    test('filter panel opens and closes', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');

      const filterToggle = page.getByRole('button', { name: /Filters/ });
      await filterToggle.click();
      await expect(page.locator('#filter-panel')).toHaveClass(/open/);

      await filterToggle.click();
      await expect(page.locator('#filter-panel')).not.toHaveClass(/open/);
    });

    test('applying brand filter updates URL and triggers exactly one request', async ({ page }) => {
      await setupMocks(page);
      const tracker = trackRequests(page);

      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      const initialCount = tracker.list.length;

      await page.getByRole('button', { name: /Filters/ }).click();
      await page.locator('[data-testid="filter-brand"]').fill('ASUS');
      await page.locator('[data-testid="apply-filters"]').click();

      await page.waitForURL(/brand=ASUS/);
      await page.waitForTimeout(500);

      expect(page.url()).toContain('brand=ASUS');
      expect(tracker.list.length).toBe(initialCount + 1);
    });

    test('applying price filters updates URL', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');

      await page.getByRole('button', { name: /Filters/ }).click();
      await page.locator('[data-testid="filter-min-price"]').fill('1000');
      await page.locator('[data-testid="filter-max-price"]').fill('50000');
      await page.locator('[data-testid="apply-filters"]').click();

      await page.waitForURL(/minPrice=1000/);
      expect(page.url()).toContain('minPrice=1000');
      expect(page.url()).toContain('maxPrice=50000');
    });

    test('changing sort updates URL and does not send unsupported params', async ({ page }) => {
      const tracker = trackRequests(page);

      await setupMocks(page);
      await page.goto('/');

      await page.getByRole('button', { name: /Filters/ }).click();
      await page.selectOption('[data-testid="filter-sort"]', 'price_asc');
      await page.locator('[data-testid="apply-filters"]').click();

      await page.waitForURL(/sort=price_asc/);

      const lastUrl = new URL(tracker.list[tracker.list.length - 1]);
      expect(lastUrl.searchParams.get('sort')).toBe('price_asc');
      // Should not send unsupported params
      expect(lastUrl.searchParams.has('availability')).toBe(false);
      expect(lastUrl.searchParams.has('compatibility')).toBe(false);
    });

    test('clear all removes all filter chips and uses removeFilters', async ({ page }) => {
      const tracker = trackRequests(page);

      await setupMocks(page);
      await page.goto('/?category=CPU&brand=Intel&sort=price_asc');
      await page.locator('[data-testid="product-grid"]').waitFor();
      const initialCount = tracker.list.length;

      // Active filters should show
      await expect(page.locator('app-catalog-active-filters')).toBeVisible();

      await page.getByRole('button', { name: 'Clear all filters' }).click();
      await page.waitForTimeout(500);

      // URL should be clean — no search params
      const url = new URL(page.url());
      const qParams = url.searchParams;
      // There may be a trailing ? still, but no real params
      expect(qParams.has('category')).toBe(false);
      expect(qParams.has('brand')).toBe(false);
      expect(qParams.has('sort')).toBe(false);

      // One new request (the cleared state)
      expect(tracker.list.length).toBe(initialCount + 1);
    });

    test('removing a single filter chip via removeFilters with one navigation', async ({ page }) => {
      const tracker = trackRequests(page);

      await setupMocks(page);
      await page.goto('/?category=CPU&brand=Intel');
      await page.locator('[data-testid="product-grid"]').waitFor();
      const initialCount = tracker.list.length;

      // Click the "Brand: Intel" filter chip's close button
      await page.locator('app-catalog-active-filters button').filter({ hasText: 'Brand:' }).click();
      await page.waitForTimeout(500);

      const url = new URL(page.url());
      expect(url.searchParams.has('brand')).toBe(false);
      expect(url.searchParams.get('category')).toBe('CPU'); // Other filter preserved
      // One new request
      expect(tracker.list.length).toBe(initialCount + 1);
    });

    test('filter interface includes Category dropdown on desktop', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');

      await page.getByRole('button', { name: /Filters/ }).click();
      await expect(page.locator('[data-testid="filter-category"]')).toBeVisible();

      // Select a category via filter dropdown
      await page.selectOption('[data-testid="filter-category"]', 'GPU');
      await page.locator('[data-testid="apply-filters"]').click();

      await page.waitForURL(/category=GPU/);
      // Category ribbon should also reflect
      await expect(page.locator('[data-testid="category-chip-GPU"]')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test.describe('Pagination', () => {
    test('navigating to page 2 updates URL with exactly one request', async ({ page }) => {
      await setupMocks(page, { multiPage: true });
      const tracker = trackRequests(page);

      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();
      const initialCount = tracker.list.length;

      await page.getByRole('button', { name: 'Page 2' }).click();
      await page.waitForURL(/page=2/);
      await page.waitForTimeout(500);

      expect(page.url()).toContain('page=2');
      expect(tracker.list.length).toBe(initialCount + 1);
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state when no products returned', async ({ page }) => {
      await setupMocks(page, { productsResponse: EMPTY_PRODUCTS_RESPONSE });
      await page.goto('/');

      await expect(page.locator('app-empty-state')).toBeVisible();
      await expect(page.getByText('No products found')).toBeVisible();
    });
  });

  test.describe('Error State', () => {
    test('shows error state and retry button on API failure', async ({ page }) => {
      await setupMocks(page, { productsStatus: 500 });
      await page.goto('/');

      await expect(page.locator('app-error-state')).toBeVisible();
      await expect(page.getByText('Failed to load products')).toBeVisible();
    });
  });

  test.describe('Product Card Links', () => {
    test('clicking product title navigates to /products/:productId placeholder route', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();

      const firstCard = page.locator('app-catalog-product-card').first();
      const titleLink = firstCard.locator('.product-title-link');
      const href = await titleLink.getAttribute('href');
      expect(href).toMatch(/\/products\/.+/);

      // Click the link and verify navigation
      await titleLink.click();
      await page.waitForURL(/\/products\//);
      expect(page.url()).toMatch(/\/products\/.+/);
    });

    test('Sigma source link has noopener noreferrer', async ({ page }) => {
      const productsWithSource = {
        ...PRODUCTS_RESPONSE,
        items: [makeProduct({ sourceUrl: 'https://www.sigma-computer.com/item?id=abc' })]
      };
      await setupMocks(page, { productsResponse: productsWithSource });
      await page.goto('/');

      const sourceLink = page.locator('.source-link').first();
      await expect(sourceLink).toHaveAttribute('rel', /noopener/);
      await expect(sourceLink).toHaveAttribute('rel', /noreferrer/);
      await expect(sourceLink).toHaveAttribute('target', '_blank');
    });

    test('Sigma source link exists in DOM without causing external navigation', async ({ page }) => {
      // Verify the link is present and safe, without clicking it
      const productsWithSource = {
        ...PRODUCTS_RESPONSE,
        items: [makeProduct({ sourceUrl: 'https://www.sigma-computer.com/item?id=abc' })]
      };
      await setupMocks(page, { productsResponse: productsWithSource });
      await page.goto('/');

      const sourceLink = page.locator('.source-link').first();
      await expect(sourceLink).toBeVisible();
      await expect(sourceLink).toHaveAttribute('target', '_blank');
      await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');

      // Verify href is the Sigma URL
      const href = await sourceLink.getAttribute('href');
      expect(href).toBe('https://www.sigma-computer.com/item?id=abc');
    });
  });

  test.describe('Null States', () => {
    test('renders without crashing when brand, model, mpn are null', async ({ page }) => {
      const productsWithNulls = {
        ...PRODUCTS_RESPONSE,
        items: [makeProduct({ brand: null, model: null, mpn: null, sourceUrl: null, price: null })]
      };
      await setupMocks(page, { productsResponse: productsWithNulls });
      await page.goto('/');

      await expect(page.locator('app-catalog-product-card')).toBeVisible();
    });

    test('shows image fallback when images array is empty', async ({ page }) => {
      const productsNoImage = {
        ...PRODUCTS_RESPONSE,
        items: [makeProduct({ images: [] })]
      };
      await setupMocks(page, { productsResponse: productsNoImage });
      await page.goto('/');

      await expect(page.locator('.product-image-fallback')).toBeVisible();
    });
  });

  test.describe('Mobile — Filter Drawer', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('mobile shows filter toggle with drawer trigger', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();

      // On mobile, filter panel should not be directly visible
      await expect(page.locator('#filter-panel')).not.toBeVisible();

      // The overlay trigger should exist
      const filterToggle = page.getByRole('button', { name: /Filters/ });
      await expect(filterToggle).toBeVisible();
    });

    test('mobile filter toggle opens overlay as dialog, Escape closes it, focus returns to trigger', async ({ page }) => {
      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();

      const filterToggle = page.getByRole('button', { name: /Filters/ });

      // Open the mobile drawer
      await filterToggle.click();

      // Overlay dialog should be visible with role=dialog
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Close via Escape
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(dialog).not.toBeVisible();

      // Focus should return to the filter toggle trigger
      await expect(filterToggle).toBeFocused();
    });
  });

  test.describe('No N+1 requests', () => {
    test('does not make extra product or offer requests for each card', async ({ page }) => {
      const tracker = trackRequests(page);

      await setupMocks(page);
      await page.goto('/');
      await page.locator('[data-testid="product-grid"]').waitFor();

      // Allow any pending async ops
      await page.waitForTimeout(200);

      // Should be zero per-card requests
      expect(tracker.detail.length).toBe(0);
      expect(tracker.offers.length).toBe(0);
    });
  });
});
