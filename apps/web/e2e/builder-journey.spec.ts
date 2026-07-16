import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const BUILD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

interface MockBuild {
  publicId: string;
  name: string;
  version: number;
  items: Array<{
    productId: string;
    slot: string;
    quantity: number;
    unitPrice: number | null;
    totalPrice: number | null;
    productName: string;
    thumbnailUrl: string | null;
    sourceUrl: string;
    storeCode: string;
  }>;
  compatibility: {
    overallStatus: string;
    slots: Array<{ slot: string; status: string; triggeredRuleIds: string[]; topReasons?: string[] }>;
  };
  pricing: { totalPrice: number | null; itemCount: number };
  createdAt: string;
  updatedAt: string;
}

function makeEmptyBuild(version = 1): MockBuild {
  return {
    publicId: BUILD_ID,
    name: 'My Build',
    version,
    items: [],
    compatibility: {
      overallStatus: 'UNKNOWN',
      slots: [
        { slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [] },
        { slot: 'motherboard', status: 'UNKNOWN', triggeredRuleIds: [] },
        { slot: 'ram', status: 'UNKNOWN', triggeredRuleIds: [] },
        { slot: 'gpu', status: 'UNKNOWN', triggeredRuleIds: [] },
        { slot: 'storage', status: 'UNKNOWN', triggeredRuleIds: [] },
        { slot: 'psu', status: 'UNKNOWN', triggeredRuleIds: [] },
        { slot: 'case', status: 'UNKNOWN', triggeredRuleIds: [] },
      ],
    },
    pricing: { totalPrice: null, itemCount: 0 },
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
  };
}

function makeBuildWithCpu(version = 2): MockBuild {
  return {
    ...makeEmptyBuild(version),
    items: [
      {
        productId: 'prod-cpu-001',
        slot: 'cpu',
        quantity: 1,
        unitPrice: 12500,
        totalPrice: 12500,
        productName: 'AMD Ryzen 7 7800X3D',
        thumbnailUrl: null,
        sourceUrl: 'https://www.sigma-computer.com/item?id=cpu-001',
        storeCode: 'sigma',
      },
    ],
    pricing: { totalPrice: 12500, itemCount: 1 },
  };
}

function makeBuildWithCpuReplaced(version = 3): MockBuild {
  return {
    ...makeBuildWithCpu(version),
    items: [
      {
        productId: 'prod-cpu-002',
        slot: 'cpu',
        quantity: 1,
        unitPrice: 18000,
        totalPrice: 18000,
        productName: 'Intel Core i9-14900K',
        thumbnailUrl: null,
        sourceUrl: 'https://www.sigma-computer.com/item?id=cpu-002',
        storeCode: 'sigma',
      },
    ],
    pricing: { totalPrice: 18000, itemCount: 1 },
  };
}

function makeConflictError(expectedVersion: number, currentVersion: number, latestBuild: MockBuild) {
  return {
    error: 'Build version conflict',
    requestId: 'req-conflict-001',
    code: 'BUILD_VERSION_CONFLICT',
    details: { expectedVersion, currentVersion, latestBuild },
  };
}

const CANDIDATES_RESPONSE = {
  groups: [
    {
      status: 'UNKNOWN' as const,
      products: [
        {
          productId: 'prod-cpu-001',
          name: 'AMD Ryzen 7 7800X3D',
          thumbnailUrl: null,
          price: 12500,
          sourceUrl: 'https://www.sigma-computer.com/item?id=cpu-001',
          storeCode: 'sigma',
        },
        {
          productId: 'prod-cpu-002',
          name: 'Intel Core i9-14900K',
          thumbnailUrl: null,
          price: 18000,
          sourceUrl: 'https://www.sigma-computer.com/item?id=cpu-002',
          storeCode: 'sigma',
        },
      ],
      topReasons: [],
    },
  ],
  pagination: { page: 1, pageSize: 24, totalItems: 2, totalPages: 1 },
};

const PURCHASE_PLAN_RESPONSE = {
  buildPublicId: BUILD_ID,
  items: [
    {
      productId: 'prod-cpu-001',
      productName: 'AMD Ryzen 7 7800X3D',
      slot: 'cpu',
      quantity: 1,
      unitPrice: 12500,
      totalPrice: 12500,
      sourceUrl: 'https://www.sigma-computer.com/item?id=cpu-001',
      storeCode: 'sigma',
      availability: 'In Stock',
      lastSeenAt: '2025-01-15T10:00:00.000Z',
    },
  ],
  totalPrice: 12500,
  itemCount: 1,
};

// ---------------------------------------------------------------------------
// Stateful mock
// ---------------------------------------------------------------------------

interface MockState {
  build: MockBuild;
  /** When set, the next GET /builds/:id returns 404 (for recovery test) */
  nextGetReturns404: boolean;
}

function createInitialState(): MockState {
  return { build: makeEmptyBuild(1), nextGetReturns404: false };
}

function isBuildApiUrl(url: URL): boolean {
  return url.pathname.includes('/api/v1/builds');
}

function parseBuildApiPath(url: URL): { resourceId?: string; subResource?: string; slot?: string } {
  const parts = url.pathname.split('/').filter(Boolean);
  const buildsIdx = parts.indexOf('builds');
  if (buildsIdx === -1) return {};
  const afterBuilds = parts.slice(buildsIdx + 1);
  return {
    resourceId: afterBuilds[0] || undefined,
    subResource: afterBuilds[1] || undefined,
    slot: afterBuilds[2] || undefined, // items/:slot → index 2 in afterBuilds
  };
}

/** Shared route handler logic — can be used in both initial and override mocks. */
async function handleBuildApiRoute(route: Route, state: MockState) {
  const req = route.request();
  const method = req.method();
  const { resourceId, subResource, slot } = parseBuildApiPath(new URL(req.url()));

  // POST /api/v1/builds → create
  if (method === 'POST' && !resourceId) {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(state.build),
    });
    return;
  }

  // GET /api/v1/builds/:id → load
  if (method === 'GET' && resourceId && !subResource) {
    // Support one-shot 404 for recovery testing
    if (state.nextGetReturns404) {
      state.nextGetReturns404 = false;
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Build not found', requestId: 'req-001' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.build),
    });
    return;
  }

  // PATCH /api/v1/builds/:id → update
  if (method === 'PATCH' && resourceId && !subResource) {
    state.build.version++;
    state.build.updatedAt = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.build),
    });
    return;
  }

  // GET /api/v1/builds/:id/candidates/:slot
  if (method === 'GET' && resourceId && subResource === 'candidates') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CANDIDATES_RESPONSE),
    });
    return;
  }

  // GET /api/v1/builds/:id/purchase-plan
  if (method === 'GET' && resourceId && subResource === 'purchase-plan') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PURCHASE_PLAN_RESPONSE),
    });
    return;
  }

  // POST /api/v1/builds/:id/validate
  if (method === 'POST' && resourceId && subResource === 'validate') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.build),
    });
    return;
  }

  // PUT /api/v1/builds/:id/items/:slot → add/replace
  if (method === 'PUT' && resourceId && subResource === 'items' && slot) {
    const body = JSON.parse(req.postData() || '{}');

    if (body.expectedVersion !== state.build.version) {
      const conflictBuild = { ...state.build, version: state.build.version + 1 };
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(makeConflictError(body.expectedVersion, state.build.version, conflictBuild)),
      });
      return;
    }

    const product = CANDIDATES_RESPONSE.groups
      .flatMap((g) => g.products)
      .find((p) => p.productId === body.productId);

    if (!product) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Product not found', requestId: 'req-001' }),
      });
      return;
    }

    state.build.items = state.build.items.filter((i) => i.slot !== slot);
    state.build.items.push({
      productId: product.productId,
      slot,
      quantity: body.quantity,
      unitPrice: product.price,
      totalPrice: product.price != null ? product.price * body.quantity : null,
      productName: product.name,
      thumbnailUrl: product.thumbnailUrl,
      sourceUrl: product.sourceUrl,
      storeCode: product.storeCode,
    });

    state.build.pricing = {
      totalPrice: state.build.items.reduce((sum, i) => sum + (i.totalPrice ?? 0), 0),
      itemCount: state.build.items.length,
    };
    state.build.version++;
    state.build.updatedAt = new Date().toISOString();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.build),
    });
    return;
  }

  // DELETE /api/v1/builds/:id/items/:slot → remove
  if (method === 'DELETE' && resourceId && subResource === 'items' && slot) {
    const body = JSON.parse(req.postData() || '{}');

    if (body.expectedVersion !== state.build.version) {
      const conflictBuild = { ...state.build, version: state.build.version + 1 };
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(makeConflictError(body.expectedVersion, state.build.version, conflictBuild)),
      });
      return;
    }

    state.build.items = state.build.items.filter((i) => i.slot !== slot);
    state.build.pricing = {
      totalPrice: state.build.items.length > 0
        ? state.build.items.reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
        : null,
      itemCount: state.build.items.length,
    };
    state.build.version++;
    state.build.updatedAt = new Date().toISOString();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.build),
    });
    return;
  }

  await route.fallback();
}

function setupStatefulMocks(page: Page, state: MockState) {
  page.route(
    (url: URL) => isBuildApiUrl(url),
    async (route: Route) => handleBuildApiRoute(route, state),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForBuilderLoaded(page: Page) {
  await page.waitForURL(new RegExp(`/builder/${BUILD_ID}`));
  await expect(page.locator('#builder-heading')).toHaveText('PC Builder');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Builder Journey — Full Persistent Build Lifecycle', () => {
  test('create build, add/replace/clear component, reload persistence, navigate to purchase plan', async ({ page }) => {
    const state = createInitialState();
    await setupStatefulMocks(page, state);

    // --- Step 1: Navigate to /builder → creates new build, redirects to canonical URL ---
    await page.goto('/builder');
    await waitForBuilderLoaded(page);

    await expect(page.locator('.builder-subtitle')).toContainText('Assemble your ideal PC configuration');

    // Verify all 7 slots are rendered and empty
    const slotLabels = ['CPU', 'Motherboard', 'RAM', 'GPU', 'Storage', 'PSU', 'Case'];
    for (const label of slotLabels) {
      await expect(page.locator(`#slot-label-${label.toLowerCase()}`)).toBeVisible();
    }

    const emptyStatuses = page.locator('.slot-status');
    await expect(emptyStatuses).toHaveCount(7);
    for (const status of await emptyStatuses.all()) {
      await expect(status).toHaveText('Empty');
    }

    // Summary should show 0/7 filled, deferred total, unknown compatibility
    await expect(page.locator('.summary-stats')).toContainText('0 / 7');

    // Purchase plan link should exist with correct build ID
    const purchaseLink = page.locator('.purchase-plan-nav a');
    await expect(purchaseLink).toBeVisible();
    const href = await purchaseLink.getAttribute('href');
    expect(href).toContain(`/purchase-plan?buildId=${BUILD_ID}`);

    // --- Step 2: Click "Add CPU" → opens selection drawer ---
    await page.getByRole('button', { name: 'Add CPU' }).click();
    await expect(page.locator('.selection-drawer')).toBeVisible();
    await expect(page.locator('.drawer-title')).toHaveText('Select CPU');
    await expect(page.locator('.product-row')).toHaveCount(2);
    await expect(page.locator('.product-name').first()).toHaveText('AMD Ryzen 7 7800X3D');
    await expect(page.locator('.product-name').last()).toHaveText('Intel Core i9-14900K');

    // --- Step 3: Select first candidate (AMD Ryzen) → PUT add ---
    await page.getByRole('button', { name: 'Select AMD Ryzen 7 7800X3D' }).click();
    await expect(page.locator('.selection-drawer')).not.toBeVisible();
    await expect(page.locator('.slot-filled')).toHaveCount(1);
    await expect(page.locator('.slot-product-name').first()).toHaveText('AMD Ryzen 7 7800X3D');
    await expect(page.locator('.summary-stats')).toContainText('1 / 7');

    // --- Step 4: Click "Replace CPU" → open drawer again ---
    await page.getByRole('button', { name: 'Replace CPU' }).click();
    await expect(page.locator('.selection-drawer')).toBeVisible();
    await expect(page.locator('.drawer-title')).toHaveText('Select CPU');

    // --- Step 5: Select second candidate (Intel i9) → PUT replace ---
    await page.getByRole('button', { name: 'Select Intel Core i9-14900K' }).click();
    await expect(page.locator('.selection-drawer')).not.toBeVisible();
    await expect(page.locator('.slot-product-name').first()).toHaveText('Intel Core i9-14900K');

    // --- Step 6: Click "Clear CPU" → DELETE remove ---
    await page.getByRole('button', { name: 'Clear CPU' }).click();
    await expect(page.locator('.slot-filled')).toHaveCount(0);
    const allEmpty = page.locator('.slot-status');
    await expect(allEmpty).toHaveCount(7);
    await expect(page.locator('.summary-stats')).toContainText('0 / 7');

    // --- Step 7: Re-add CPU for persistence test ---
    await page.getByRole('button', { name: 'Add CPU' }).click();
    await page.getByRole('button', { name: 'Select AMD Ryzen 7 7800X3D' }).click();
    await expect(page.locator('.selection-drawer')).not.toBeVisible();
    await expect(page.locator('.slot-product-name').first()).toHaveText('AMD Ryzen 7 7800X3D');

    // --- Step 8: Reload page → persistence via canonical URL ---
    await page.goto(`/builder/${BUILD_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.slot-product-name').first()).toHaveText('AMD Ryzen 7 7800X3D');
    await expect(page.locator('.summary-stats')).toContainText('1 / 7');

    // --- Step 9: Navigate to purchase plan ---
    await page.locator('.purchase-plan-nav a').click();
    await page.waitForURL(/\/purchase-plan/);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#purchase-plan-heading')).toHaveText('Purchase Plan');
    await expect(page.locator('.items-table')).toBeVisible();

    const rows = page.locator('.items-table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('.cell-slot')).toHaveText('CPU');
    await expect(page.locator('.cell-product')).toHaveText('AMD Ryzen 7 7800X3D');
    await expect(page.locator('.cell-price')).toHaveText('12,500 EGP');

    // Source link should be safe
    const sourceLink = page.locator('.source-link');
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute('target', '_blank');
    await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    const sourceHref = await sourceLink.getAttribute('href');
    expect(sourceHref).toBe('https://www.sigma-computer.com/item?id=cpu-001');

    // Back to builder link
    const backLink = page.locator('.plan-actions a');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/builder');
  });

  test('version conflict shows notice and replaces state without auto-replay', async ({ page }) => {
    const state = createInitialState();
    await setupStatefulMocks(page, state);

    // Create build
    await page.goto('/builder');
    await waitForBuilderLoaded(page);

    // Add CPU
    await page.getByRole('button', { name: 'Add CPU' }).click();
    await page.getByRole('button', { name: 'Select AMD Ryzen 7 7800X3D' }).click();
    await expect(page.locator('.slot-product-name').first()).toHaveText('AMD Ryzen 7 7800X3D');

    // Override PUT to always return 409 conflict
    await page.unroute((url: URL) => isBuildApiUrl(url));
    await page.route(
      (url: URL) => isBuildApiUrl(url),
      async (route: Route) => {
        const req = route.request();
        const method = req.method();
        const { resourceId, subResource, slot } = parseBuildApiPath(new URL(req.url()));

        // PUT /items → conflict
        if (method === 'PUT' && resourceId && subResource === 'items' && slot) {
          const conflictBuild = makeBuildWithCpuReplaced(state.build.version + 1);
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify(makeConflictError(state.build.version, state.build.version + 1, conflictBuild)),
          });
          return;
        }

        // Delegate everything else to the shared handler
        await handleBuildApiRoute(route, state);
      },
    );

    // Try to replace CPU → triggers conflict
    await page.getByRole('button', { name: 'Replace CPU' }).click();
    await expect(page.locator('.selection-drawer')).toBeVisible();
    await page.getByRole('button', { name: 'Select Intel Core i9-14900K' }).click();

    // Conflict notice should appear
    await expect(page.locator('.conflict-notice')).toBeVisible();
    await expect(page.locator('.conflict-text')).toContainText('modified by another request');

    // State should be replaced with the latestBuild from conflict (Intel i9)
    await expect(page.locator('.slot-product-name').first()).toHaveText('Intel Core i9-14900K');

    // Selection drawer should be closed after conflict
    await expect(page.locator('.selection-drawer')).not.toBeVisible();

    // Dismiss the conflict notice
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.locator('.conflict-notice')).not.toBeVisible();
  });

  test('invalid saved ID recovery creates new build', async ({ page }) => {
    const state = createInitialState();
    await setupStatefulMocks(page, state);

    // First create a build normally
    await page.goto('/builder');
    await waitForBuilderLoaded(page);

    // Set flag: next GET /builds/:id returns 404 (simulates deleted build)
    state.nextGetReturns404 = true;

    // Navigate to /builder → saved ID returns 404, then creates new build
    await page.goto('/builder');
    await waitForBuilderLoaded(page);

    // Should show the builder with empty slots (new build)
    await expect(page.locator('.summary-stats')).toContainText('0 / 7');
  });

  test('candidates show UNKNOWN status, never PASS', async ({ page }) => {
    const state = createInitialState();
    await setupStatefulMocks(page, state);

    await page.goto('/builder');
    await waitForBuilderLoaded(page);

    // Open CPU selection
    await page.getByRole('button', { name: 'Add CPU' }).click();
    await expect(page.locator('.selection-drawer')).toBeVisible();

    // No "Pass" claims should be visible
    const drawerText = await page.locator('.selection-drawer').textContent();
    expect(drawerText).not.toContain('Pass');
  });

  test('renders four candidate groups and persisted incompatibility evidence', async ({ page }) => {
    const state = createInitialState();
    await page.route(
      (url: URL) => isBuildApiUrl(url),
      async (route: Route) => {
        const request = route.request();
        const { resourceId, subResource, slot } = parseBuildApiPath(new URL(request.url()));
        if (request.method() === 'GET' && resourceId && subResource === 'candidates') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              groups: [
                { status: 'COMPATIBLE', products: [CANDIDATES_RESPONSE.groups[0].products[0]], topReasons: ['Socket matches'] },
                { status: 'COMPATIBLE_WITH_WARNINGS', products: [{ ...CANDIDATES_RESPONSE.groups[0].products[0], productId: 'warning-cpu', name: 'Warning CPU' }], topReasons: ['Limited headroom'] },
                { status: 'UNKNOWN', products: [{ ...CANDIDATES_RESPONSE.groups[0].products[0], productId: 'unknown-cpu', name: 'Unknown CPU' }], topReasons: [] },
                { status: 'INCOMPATIBLE', products: [CANDIDATES_RESPONSE.groups[0].products[1]], topReasons: ['CPU socket LGA1700 does not match AM5'] },
              ],
              pagination: { page: 1, pageSize: 24, totalItems: 4, totalPages: 1 },
            }),
          });
          return;
        }
        if (request.method() === 'PUT' && resourceId && subResource === 'items' && slot === 'cpu') {
          state.build = makeBuildWithCpuReplaced(state.build.version + 1);
          state.build.compatibility.overallStatus = 'INCOMPATIBLE';
          state.build.compatibility.slots = state.build.compatibility.slots.map((result) =>
            result.slot === 'cpu'
              ? {
                  ...result,
                  status: 'INCOMPATIBLE',
                  triggeredRuleIds: ['CMP-CPU-MB-001'],
                  topReasons: ['CPU socket LGA1700 does not match AM5'],
                }
              : result,
          );
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.build) });
          return;
        }
        await handleBuildApiRoute(route, state);
      },
    );

    await page.goto('/builder');
    await waitForBuilderLoaded(page);
    await page.getByRole('button', { name: 'Add CPU' }).click();

    await expect(page.locator('.status-badge')).toHaveText([
      'Compatible',
      'Compatible with Warnings',
      'Unknown Compatibility',
      'Incompatible',
    ]);
    await page.getByRole('button', { name: 'Select Intel Core i9-14900K' }).click();

    await expect(page.locator('.compatibility-badge').first()).toHaveText('Incompatible');
    await expect(page.locator('.compatibility-evidence').first()).toContainText('CPU socket LGA1700 does not match AM5');
    await expect(page.locator('.compatibility-evidence').first()).toContainText('CMP-CPU-MB-001');
  });

  test('seven slots in correct order, all empty on new build', async ({ page }) => {
    const state = createInitialState();
    await setupStatefulMocks(page, state);

    await page.goto('/builder');
    await waitForBuilderLoaded(page);

    // All 7 slots should have Add buttons
    const addButtons = page.getByRole('button', { name: /^Add / });
    await expect(addButtons).toHaveCount(7);

    // Verify slot order by checking ordinal numbers
    const ordinals = page.locator('.slot-ordinal');
    for (let i = 0; i < 7; i++) {
      await expect(ordinals.nth(i)).toHaveText(String(i + 1));
    }
  });
});
