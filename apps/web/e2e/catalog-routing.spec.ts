import { test, expect } from '@playwright/test';

test.describe('Catalog Routing and Query State', () => {

  test('/catalog with query parameters resolves to / with parameters preserved', async ({ page }) => {
    // Intercept API to prevent backend dependency
    await page.route('**/api/v1/products*', route => {
      route.fulfill({ status: 200, json: { items: [], pagination: { page: 2, pageSize: 24, totalItems: 0, totalPages: 0 } } });
    });

    const requestPromise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goto('/catalog?search=rtx&page=2&sort=price_asc');
    const req = await requestPromise;

    // Should immediately redirect to /
    await expect(page).toHaveURL(/.*search=rtx.*/);
    await expect(page).toHaveURL(/.*page=2.*/);
    await expect(page).toHaveURL(/.*sort=price_asc.*/);
    await expect(page).not.toHaveURL(/.*catalog.*/);
    
    const url = new URL(req.url());
    expect(url.searchParams.get('search')).toBe('rtx');
    expect(url.searchParams.get('page')).toBe('2');
  });

  test('Invalid values normalize without a redirect loop and send correct API request', async ({ page }) => {
    await page.route('**/api/v1/products*', route => {
      route.fulfill({ status: 200, json: { items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } } });
    });

    const requestPromise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goto('/?page=-5&pageSize=500&sort=hacked&minPrice=100&maxPrice=50');
    const req = await requestPromise;

    const url = new URL(req.url());
    expect(url.searchParams.get('page')).toBe('1'); // Normalized from -5 to 1
    expect(url.searchParams.get('pageSize')).toBe('100'); // Normalized from 500 to 100
    expect(url.searchParams.has('sort')).toBeFalsy(); // Dropped invalid sort
    expect(url.searchParams.has('minPrice')).toBeFalsy(); // Dropped because minPrice > maxPrice
    expect(url.searchParams.get('maxPrice')).toBe('50'); // Kept
  });

  test('Reload preserves URL-driven state', async ({ page }) => {
    await page.route('**/api/v1/products*', route => {
      route.fulfill({ status: 200, json: { items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } } });
    });

    const requestPromise1 = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goto('/?search=intel&category=CPU');
    const req1 = await requestPromise1;

    expect(new URL(req1.url()).searchParams.get('search')).toBe('intel');
    expect(new URL(req1.url()).searchParams.get('category')).toBe('CPU');

    // Reload the page
    const requestPromise2 = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.reload();
    const req2 = await requestPromise2;

    // Verify URL remains exactly the same
    await expect(page).toHaveURL(/.*search=intel.*/);
    await expect(page).toHaveURL(/.*category=CPU.*/);
    
    expect(new URL(req2.url()).searchParams.get('search')).toBe('intel');
  });

  test('Back/forward restores query state', async ({ page }) => {
    await page.route('**/api/v1/products*', route => {
      route.fulfill({ status: 200, json: { items: [], pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 } } });
    });

    // Step 1: goto /
    const req1Promise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goto('/');
    await req1Promise;

    // Step 2: Navigate to a filtered view
    const req2Promise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goto('/?search=rtx');
    const req2 = await req2Promise;
    expect(new URL(req2.url()).searchParams.get('search')).toBe('rtx');

    // Step 3: Navigate to page 2
    const req3Promise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goto('/?search=rtx&page=2');
    const req3 = await req3Promise;
    expect(new URL(req3.url()).searchParams.get('page')).toBe('2');

    // Step 4: Go back to /?search=rtx
    const req4Promise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goBack();
    const req4 = await req4Promise;
    expect(new URL(req4.url()).searchParams.get('page')).toBe('1'); // page 1 is default internally sent to API
    expect(new URL(req4.url()).searchParams.get('search')).toBe('rtx');

    // Step 5: Go back to /
    const req5Promise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goBack();
    const req5 = await req5Promise;
    expect(new URL(req5.url()).searchParams.has('search')).toBeFalsy();
    expect(new URL(req5.url()).searchParams.get('page')).toBe('1');

    // Step 6: Go forward to /?search=rtx
    const req6Promise = page.waitForRequest(r => r.url().includes('/api/v1/products'));
    await page.goForward();
    const req6 = await req6Promise;
    expect(new URL(req6.url()).searchParams.get('search')).toBe('rtx');
  });

});
