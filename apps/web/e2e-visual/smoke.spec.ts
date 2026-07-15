import { test, expect } from '@playwright/test';

test('visual configuration loads builder-filled', async ({ page }) => {
  await page.goto('/__visual/builder-filled');
  await expect(page.locator('body')).not.toContainText('Page Not Found');
  await expect(page.locator('#builder-heading')).toContainText('PC Builder');
});

test('visual configuration loads component-selection', async ({ page }) => {
  await page.goto('/__visual/component-selection');
  await expect(page.locator('body')).not.toContainText('Page Not Found');
  await expect(page.locator('#selection-heading')).toContainText('Component Selection');
});

test('visual configuration loads build-review-filled', async ({ page }) => {
  await page.goto('/__visual/build-review-filled');
  await expect(page.locator('body')).not.toContainText('Page Not Found');
  await expect(page.locator('#review-heading')).toContainText('Purchase Plan');
});

test('visual configuration loads mobile-builder', async ({ page }) => {
  await page.goto('/__visual/mobile-builder');
  await expect(page.locator('body')).not.toContainText('Page Not Found');
  await expect(page.locator('#builder-heading')).toContainText('PC Builder');
});
