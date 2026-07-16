# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\web\e2e\smoke.spec.ts >> production configuration resolves to Not Found UI for __visual/build-review-filled
- Location: apps\web\e2e\smoke.spec.ts:18:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/__visual/build-review-filled", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('production configuration loads home page', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await expect(page).toHaveTitle(/BuildSense/);
  6  | });
  7  | 
  8  | test('production configuration resolves to Not Found UI for __visual/builder-filled', async ({ page }) => {
  9  |   await page.goto('/__visual/builder-filled');
  10 |   await expect(page.locator('h1')).toContainText('Page not found');
  11 | });
  12 | 
  13 | test('production configuration resolves to Not Found UI for __visual/component-selection', async ({ page }) => {
  14 |   await page.goto('/__visual/component-selection');
  15 |   await expect(page.locator('h1')).toContainText('Page not found');
  16 | });
  17 | 
  18 | test('production configuration resolves to Not Found UI for __visual/build-review-filled', async ({ page }) => {
> 19 |   await page.goto('/__visual/build-review-filled');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  20 |   await expect(page.locator('h1')).toContainText('Page not found');
  21 | });
  22 | 
  23 | test('production configuration resolves to Not Found UI for __visual/mobile-builder', async ({ page }) => {
  24 |   await page.goto('/__visual/mobile-builder');
  25 |   await expect(page.locator('h1')).toContainText('Page not found');
  26 | });
  27 | 
  28 | test.describe('production capability boundary', () => {
  29 |   test('production Builder has no fixture data or hardcoded totals', async ({ page }) => {
  30 |     const requests: string[] = [];
  31 |     page.on('request', (req) => requests.push(req.url()));
  32 | 
  33 |     await page.goto('/builder');
  34 |     await page.waitForLoadState('networkidle');
  35 | 
  36 |     // No fixture product names
  37 |     const body = await page.textContent('body');
  38 |     expect(body).not.toContain('Ryzen');
  39 |     expect(body).not.toContain('Intel');
  40 |     expect(body).not.toContain('GeForce');
  41 |     expect(body).not.toContain('NVIDIA');
  42 |     expect(body).not.toContain('Corsair');
  43 |     expect(body).not.toContain('Samsung');
  44 | 
  45 |     // No fixture prices
  46 |     expect(body).not.toContain('78,900');
  47 |     expect(body).not.toContain('18,500');
  48 | 
  49 |     // No compatibility claims (UNKNOWN is the truthful status)
  50 |     expect(body).not.toMatch(/\bCompatible\b/);
  51 |     expect(body).not.toMatch(/\bIncompatible\b/);
  52 | 
  53 |     // No localStorage
  54 |     expect(body?.toLowerCase()).not.toContain('saved build');
  55 | 
  56 |     // Builder now creates a build via API (POST /api/v1/builds) — this is expected.
  57 |     // Verify no fixture data leaked via API calls.
  58 |     const apiCalls = requests.filter((url) => url.includes('/api/') && !url.includes('/api/health'));
  59 |     // At least one API call (POST create) is expected for the production builder.
  60 |     // The key assertion: no fixture product names appear in the page.
  61 |   });
  62 | 
  63 |   test('production Purchase Plan has no fixture data, API calls, or totals', async ({ page }) => {
  64 |     const requests: string[] = [];
  65 |     page.on('request', (req) => requests.push(req.url()));
  66 | 
  67 |     await page.goto('/purchase-plan');
  68 |     await page.waitForLoadState('networkidle');
  69 | 
  70 |     const body = await page.textContent('body');
  71 |     expect(body).not.toContain('Ryzen');
  72 |     expect(body).not.toContain('Intel');
  73 |     expect(body).not.toContain('78,900');
  74 |     expect(body).not.toContain('Compatible');
  75 |     expect(body?.toLowerCase()).not.toContain('saved build');
  76 | 
  77 |     const apiCalls = requests.filter((url) => url.includes('/api/') && !url.includes('/api/health'));
  78 |     expect(apiCalls).toHaveLength(0);
  79 |   });
  80 | });
  81 | 
```