import { test, expect } from '@playwright/test';

/** Track product-list vs detail vs offers requests */
interface RequestTracker {
  list: string[];
  detail: string[];
  offers: string[];
}

function trackRequests(page: import('@playwright/test').Page): RequestTracker {
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

const EMPTY_RESPONSE = { items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } };

test.describe('Catalog Routing and Query State', () => {
  test('/catalog with query parameters resolves to / with parameters preserved, exactly one list request', async ({ page }) => {
    // Intercept API — use narrow pattern for list only
    const listRequests: string[] = [];
    await page.route('**/api/v1/products?**', route => {
      listRequests.push(route.request().url());
      route.fulfill({ status: 200, json: EMPTY_RESPONSE });
    });
    // Prevent product detail calls from failing
    await page.route('**/api/v1/products/*', route => {
      // Only product detail paths (has path segment after products/)
      route.fulfill({ status: 200, json: {} });
    });

    const tracker = trackRequests(page);
    await page.goto('/catalog?search=rtx&page=2&sort=price_asc');

    // Should immediately redirect to /
    await expect(page).toHaveURL(/.*search=rtx.*/);
    await expect(page).toHaveURL(/.*page=2.*/);
    await expect(page).toHaveURL(/.*sort=price_asc.*/);
    await expect(page).not.toHaveURL(/.*catalog.*/);

    await page.waitForTimeout(500);

    // Exactly one list request (should not have duplicate)
    expect(tracker.list.length).toBe(1);
    const url = new URL(tracker.list[0]);
    expect(url.searchParams.get('search')).toBe('rtx');
    expect(url.searchParams.get('page')).toBe('2');
    // No detail or offers
    expect(tracker.detail.length).toBe(0);
    expect(tracker.offers.length).toBe(0);
  });

  test('Invalid values normalize without a redirect loop and send correct API request', async ({ page }) => {
    await page.route('**/api/v1/products?**', route => {
      route.fulfill({ status: 200, json: EMPTY_RESPONSE });
    });

    const tracker = trackRequests(page);
    await page.goto('/?page=-5&pageSize=500&sort=hacked&minPrice=100&maxPrice=50');

    await page.waitForTimeout(500);

    // Exactly one list request
    expect(tracker.list.length).toBe(1);
    const url = new URL(tracker.list[0]);
    expect(url.searchParams.get('page')).toBe('1'); // Normalized from -5 to 1
    expect(url.searchParams.get('pageSize')).toBe('100'); // Normalized from 500 to 100
    expect(url.searchParams.has('sort')).toBeFalsy(); // Dropped invalid sort
    expect(url.searchParams.has('minPrice')).toBeFalsy(); // Dropped because minPrice > maxPrice
    expect(url.searchParams.get('maxPrice')).toBe('50'); // Kept
  });

  test('Reload preserves URL-driven state, exactly one request per navigation', async ({ page }) => {
    await page.route('**/api/v1/products?**', route => {
      route.fulfill({ status: 200, json: EMPTY_RESPONSE });
    });

    const tracker = trackRequests(page);

    await page.goto('/?search=intel&category=CPU');

    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(1);
    expect(new URL(tracker.list[0]!).searchParams.get('search')).toBe('intel');
    expect(new URL(tracker.list[0]!).searchParams.get('category')).toBe('CPU');

    // Reload the page
    await page.reload();
    await page.waitForTimeout(500);

    // Verify URL remains exactly the same
    await expect(page).toHaveURL(/.*search=intel.*/);
    await expect(page).toHaveURL(/.*category=CPU.*/);

    // Exactly one request after reload
    expect(tracker.list.length).toBe(2);
    expect(new URL(tracker.list[1]!).searchParams.get('search')).toBe('intel');
  });

  test('Back/forward restores query state, one request per navigation', async ({ page }) => {
    await page.route('**/api/v1/products?**', route => {
      route.fulfill({ status: 200, json: EMPTY_RESPONSE });
    });

    const tracker = trackRequests(page);

    // Step 1: goto /
    await page.goto('/');
    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(1);

    // Step 2: Navigate to a filtered view
    await page.goto('/?search=rtx');
    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(2);
    expect(new URL(tracker.list[1]!).searchParams.get('search')).toBe('rtx');

    // Step 3: Navigate to page 2
    await page.goto('/?search=rtx&page=2');
    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(3);
    expect(new URL(tracker.list[2]!).searchParams.get('page')).toBe('2');

    // Step 4: Go back to /?search=rtx
    await page.goBack();
    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(4);
    expect(new URL(tracker.list[3]!).searchParams.get('search')).toBe('rtx');

    // Step 5: Go back to /
    await page.goBack();
    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(5);
    expect(new URL(tracker.list[4]!).searchParams.has('search')).toBeFalsy();

    // Step 6: Go forward to /?search=rtx
    await page.goForward();
    await page.waitForTimeout(500);
    expect(tracker.list.length).toBe(6);
    expect(new URL(tracker.list[5]!).searchParams.get('search')).toBe('rtx');
  });
});
