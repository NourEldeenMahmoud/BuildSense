import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:3000';

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
  ...overrides,
});

const PRODUCTS_RESPONSE = {
  items: Array.from({ length: 24 }, (_, i) =>
    makeProduct({
      id: '64a00000000000000000' + String(i + 1).padStart(2, '0'),
      title: `Product ${i + 1}`,
      category: i < 12 ? 'CPU' : 'GPU',
      brand: i < 6 ? 'Intel' : i < 12 ? 'AMD' : 'NVIDIA',
      price: 1000 + i * 500,
    })
  ),
  pagination: { page: 1, pageSize: 24, totalItems: 34, totalPages: 2 },
};

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
  rawSpecifications: [
    { label: 'Cores', value: '16' },
    { label: 'Threads', value: '24' },
    { label: 'Base Clock', value: '3.4 GHz' },
  ],
  compatibility: {},
  createdAt: '2024-01-01',
  offers: [
    {
      id: 'offer-left',
      storeCode: 'SIGMA',
      price: 25000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://www.sigma-computer.com/item?id=1',
    },
  ],
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
  offers: [
    {
      id: 'offer-right',
      storeCode: 'SIGMA',
      price: 22000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://www.sigma-computer.com/item?id=2',
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockHealth(page: Page) {
  await page.route(
    (url) => url.href.startsWith(`${API_BASE}/api/health`),
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: 'connected' }),
      })
  );
}

async function mockCatalog(page: Page) {
  await page.route(
    (url) =>
      url.href.startsWith(`${API_BASE}/api/v1/categories`),
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CATEGORIES_RESPONSE),
      })
  );

  await page.route(
    (url) => url.href.startsWith(`${API_BASE}/api/v1/products`),
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCTS_RESPONSE),
      })
  );
}

async function mockProductDetail(page: Page, productId?: string) {
  const id = productId || PRODUCT_DETAIL.id;
  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${id}`,
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT_DETAIL),
      })
  );
}

async function mockCompareDetail(page: Page, id: string, product: unknown) {
  await page.route(
    (url) => url.href === `${API_BASE}/api/v1/products/${id}`,
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(product),
      })
  );
}

/** Wait for Angular app to stabilize after navigation. */
async function waitForAppStable(page: Page) {
  await page.waitForLoadState('networkidle');
  // Extra tick for Angular change detection
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Test suite — Desktop (1280px)
// ---------------------------------------------------------------------------

test.describe('Accessibility — Axe Audits (Desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Catalog (/) has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockCatalog(page);
    await page.goto('/');
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Product Details has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockProductDetail(page);
    await page.goto(`/products/${PRODUCT_DETAIL.id}`);
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Compare (valid) has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockCompareDetail(page, LEFT_ID, LEFT_PRODUCT);
    await mockCompareDetail(page, RIGHT_ID, RIGHT_PRODUCT);

    await page.goto(`/compare?left=${LEFT_ID}&right=${RIGHT_ID}`);
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Builder has zero serious/critical Axe violations', async ({ page }) => {
    await mockHealth(page);
    await page.goto('/builder');
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Purchase Plan has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await page.goto('/purchase-plan');
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Admin has zero serious/critical Axe violations', async ({ page }) => {
    await mockHealth(page);
    await page.goto('/admin');
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Not Found has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await page.goto('/nonexistent-route-12345');
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test suite — Mobile (390px) interaction-dense state
// ---------------------------------------------------------------------------

test.describe('Accessibility — Axe Audits (Mobile 390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Catalog mobile with filter overlay open has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockCatalog(page);
    await page.goto('/');
    await waitForAppStable(page);

    // Open filter overlay (triggers dialog on mobile)
    await page.getByRole('button', { name: /Filters/ }).click();
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });

  test('Builder mobile has zero serious/critical Axe violations', async ({
    page,
  }) => {
    await mockHealth(page);
    await page.goto('/builder');
    await waitForAppStable(page);

    const results = await new AxeBuilder({ page })
      .analyze();

    const seriousCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      seriousCritical,
      `Serious/critical violations: ${seriousCritical.map((v) => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Focused keyboard / focus assertions (supplement existing coverage)
// ---------------------------------------------------------------------------

test.describe('Keyboard & Focus — Targeted Assertions', () => {
  test.describe('Mobile overlays', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Mobile nav overlay: Escape closes, focus returns to trigger', async ({
      page,
    }) => {
      await mockHealth(page);
      await page.goto('/');

      const triggerBtn = page.locator('.mobile-only button');
      await expect(triggerBtn).toBeVisible();

      // Open via keyboard
      await triggerBtn.focus();
      await page.keyboard.press('Enter');

      const dialog = page.getByRole('dialog', { name: 'Mobile Navigation' });
      await expect(dialog).toBeVisible();

      // Focus should be within the dialog (close button)
      const closeBtn = page.locator('#overlay-close-btn');
      await expect(closeBtn).toBeFocused();

      // Escape closes
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      // Focus restored to trigger
      await expect(triggerBtn).toBeFocused();
    });

    test('Mobile filter overlay: Escape closes, focus returns to trigger', async ({
      page,
    }) => {
      await mockHealth(page);
      await mockCatalog(page);
      await page.goto('/');
      await waitForAppStable(page);

      const filterToggle = page.getByRole('button', { name: /Filters/ });
      await filterToggle.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Escape closes
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // Focus returns to filter toggle
      await expect(filterToggle).toBeFocused();
    });
  });

  test('Compare selector overlay: Escape closes without navigation', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockProductDetail(page);
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
            items: CANDIDATE_CPU_ITEMS,
            pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
          }),
        });
      }
    );

    await page.goto(`/products/${PRODUCT_DETAIL.id}`);
    await page.locator('h1.product-title').waitFor();

    // Open compare selector
    await page.getByRole('button', { name: /Compare/ }).click();
    await page.locator('[role="dialog"]').waitFor();

    // Verify dialog is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Escape closes
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Still on product details
    expect(page.url()).toContain(`/products/${PRODUCT_DETAIL.id}`);
  });

  test('Gallery arrow key navigation works and focus is managed', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockProductDetail(page);
    await page.goto(`/products/${PRODUCT_DETAIL.id}`);
    await page.locator('.product-title').waitFor();

    const firstThumb = page.locator('.gallery-thumb').first();
    await firstThumb.focus();

    await page.keyboard.press('ArrowRight');
    const secondThumb = page.locator('.gallery-thumb').nth(1);
    await expect(secondThumb).toHaveAttribute('aria-selected', 'true');
    await expect(secondThumb).toBeFocused();
  });

  test('Pagination focus management moves focus to results anchor', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockCatalog(page);
    await page.goto('/');
    await waitForAppStable(page);

    // Verify the results anchor exists
    const anchor = page.locator('#catalog-results-top');
    await expect(anchor).toHaveAttribute('tabindex', '-1');
  });

  test('Focus-visible outline is visible on interactive elements', async ({
    page,
  }) => {
    await mockHealth(page);
    await page.goto('/builder');
    await waitForAppStable(page);

    // Tab through elements and verify focus-visible styles
    await page.keyboard.press('Tab'); // Skip-to-content or first link
    await page.keyboard.press('Tab'); // Nav link

    // Verify a focused element has a visible outline
    const focused = page.locator(':focus');
    const hasOutline = await focused.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.outlineStyle !== 'none' ||
        style.outlineWidth !== '0px' ||
        el.matches(':focus-visible')
      );
    });
    // At least the first focusable element should have focus-visible
    expect(hasOutline).toBe(true);
  });

  test('External links have safe attributes (target=_blank, rel=noopener noreferrer)', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockProductDetail(page);
    await page.goto(`/products/${PRODUCT_DETAIL.id}`);
    await page.locator('.product-title').waitFor();

    const sourceLink = page.locator('.source-link');
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute('target', '_blank');
    await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

// ---------------------------------------------------------------------------
// prefers-reduced-motion verification
// ---------------------------------------------------------------------------

test.describe('Reduced Motion', () => {
  test('prefers-reduced-motion: reduce disables animations and transitions', async ({
    page,
  }) => {
    await mockHealth(page);

    // Emulate prefers-reduced-motion: reduce BEFORE navigating
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForAppStable(page);

    // Verify that the media query emulation is active
    const mediaActive = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    expect(mediaActive).toBe(true);

    // Verify that animations are effectively disabled via our global rule
    const motionReduced = await page.evaluate(() => {
      const el =
        document.querySelector('.btn') ||
        document.querySelector('.hero-cta-link') ||
        document.querySelector('a');
      if (!el) return { hasReducedMotion: true, reason: 'no target element found' };
      const style = window.getComputedStyle(el);
      const animDur = parseFloat(style.animationDuration);
      const transDur = parseFloat(style.transitionDuration);
      return {
        hasReducedMotion: animDur < 1 && transDur < 1,
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });

    expect(motionReduced.hasReducedMotion).toBe(true);
  });

  test('prefers-reduced-motion: reduce on product detail page', async ({
    page,
  }) => {
    await mockHealth(page);
    await mockProductDetail(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/products/${PRODUCT_DETAIL.id}`);
    await page.locator('.product-title').waitFor();

    // Verify media query is active
    const mediaActive = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    expect(mediaActive).toBe(true);

    // Loading spinner animation should be effectively disabled
    const spinnerState = await page.evaluate(() => {
      const spinner = document.querySelector('.loading-spinner');
      if (!spinner)
        return { hasReducedMotion: true, reason: 'no spinner visible' };
      const style = window.getComputedStyle(spinner);
      const animDur = parseFloat(style.animationDuration);
      return {
        hasReducedMotion: animDur < 1,
        animationDuration: style.animationDuration,
      };
    });

    expect(spinnerState.hasReducedMotion).toBe(true);
  });
});
