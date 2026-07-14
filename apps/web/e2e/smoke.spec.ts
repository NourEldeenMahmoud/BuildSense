import { test, expect } from '@playwright/test';

test('production configuration loads home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/BuildSense/);
});

test('production configuration resolves to Not Found UI for visual routes', async ({ page }) => {
  await page.goto('/__visual/builder-filled');
  await expect(page.locator('h1')).toContainText('Page not found');
});
