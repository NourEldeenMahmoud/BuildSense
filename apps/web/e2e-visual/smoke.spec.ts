import { test, expect } from '@playwright/test';

test('visual configuration loads builder-filled', async ({ page }) => {
  await page.goto('/__visual/builder-filled');
  // Should not be the 404 page
  await expect(page.locator('body')).not.toContainText('Page Not Found');
});
