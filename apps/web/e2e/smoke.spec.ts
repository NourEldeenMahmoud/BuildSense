import { test, expect } from '@playwright/test';

test('production configuration loads home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/BuildSense/);
});

test('production configuration resolves to Not Found UI for __visual/builder-filled', async ({ page }) => {
  await page.goto('/__visual/builder-filled');
  await expect(page.locator('h1')).toContainText('Page not found');
});

test('production configuration resolves to Not Found UI for __visual/component-selection', async ({ page }) => {
  await page.goto('/__visual/component-selection');
  await expect(page.locator('h1')).toContainText('Page not found');
});

test('production configuration resolves to Not Found UI for __visual/build-review-filled', async ({ page }) => {
  await page.goto('/__visual/build-review-filled');
  await expect(page.locator('h1')).toContainText('Page not found');
});

test('production configuration resolves to Not Found UI for __visual/mobile-builder', async ({ page }) => {
  await page.goto('/__visual/mobile-builder');
  await expect(page.locator('h1')).toContainText('Page not found');
});

test.describe('production capability boundary', () => {
  test('production Builder has no fixture data, API calls, or totals', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));

    await page.goto('/builder');
    await page.waitForLoadState('networkidle');

    // No fixture product names
    const body = await page.textContent('body');
    expect(body).not.toContain('Ryzen');
    expect(body).not.toContain('Intel');
    expect(body).not.toContain('GeForce');
    expect(body).not.toContain('NVIDIA');
    expect(body).not.toContain('Corsair');
    expect(body).not.toContain('Samsung');

    // No fixture prices
    expect(body).not.toContain('78,900');
    expect(body).not.toContain('18,500');

    // No compatibility claims
    expect(body).not.toContain('Compatible');
    expect(body).not.toContain('Incompatible');

    // No localStorage
    expect(body?.toLowerCase()).not.toContain('saved build');

    // No Build API calls
    const apiCalls = requests.filter((url) => url.includes('/api/') && !url.includes('/api/health'));
    expect(apiCalls).toHaveLength(0);
  });

  test('production Purchase Plan has no fixture data, API calls, or totals', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));

    await page.goto('/purchase-plan');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).not.toContain('Ryzen');
    expect(body).not.toContain('Intel');
    expect(body).not.toContain('78,900');
    expect(body).not.toContain('Compatible');
    expect(body?.toLowerCase()).not.toContain('saved build');

    const apiCalls = requests.filter((url) => url.includes('/api/') && !url.includes('/api/health'));
    expect(apiCalls).toHaveLength(0);
  });
});
