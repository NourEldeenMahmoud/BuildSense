import { test, expect, type Page } from '@playwright/test';

/**
 * Stage 7 — Builder / Selection / Review Visual Screenshots
 *
 * Output directory: apps/web/e2e-visual/screenshots/
 * All generated .png files are gitignored.
 */

const SCREENSHOT_DIR = 'e2e-visual/screenshots';

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    return { overflow: scrollWidth > docWidth + 1, docWidth, scrollWidth };
  });
  expect(
    overflow.overflow,
    `Document horizontal overflow: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.docWidth}`
  ).toBe(false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Stage 7 — Builder Visual Screenshots', () => {

  // ===== Desktop (1280px) =====
  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('filled Builder workspace', async ({ page }) => {
      await page.goto('/__visual/builder-filled');
      await expect(page.locator('#builder-heading')).toContainText('PC Builder');
      await page.waitForTimeout(300);

      // Verify seven filled slots
      const slots = page.locator('.slot');
      await expect(slots).toHaveCount(7);

      // Verify product names visible
      await expect(page.locator('.slot-product-name').first()).toBeVisible();

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-builder-filled-1280.png`,
        fullPage: true,
      });
    });

    test('component selection drawer', async ({ page }) => {
      await page.goto('/__visual/component-selection');
      await expect(page.locator('#selection-heading')).toContainText('Component Selection');
      await page.waitForTimeout(300);

      // Verify candidates are rendered
      const rows = page.locator('.product-row');
      await expect(rows.first()).toBeVisible();
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(3);

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-component-selection-1280.png`,
        fullPage: true,
      });
    });

    test('filled Build Review', async ({ page }) => {
      await page.goto('/__visual/build-review-filled');
      await expect(page.locator('#review-heading')).toContainText('Purchase Plan');
      await page.waitForTimeout(300);

      // Verify component rows
      const rows = page.locator('app-purchase-plan-row');
      await expect(rows).toHaveCount(7);

      // Verify summary panel
      await expect(page.locator('.review-summary')).toBeVisible();

      // Verify disabled print/export buttons
      const buttons = page.locator('.review-summary button');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < count; i++) {
        await expect(buttons.nth(i)).toBeDisabled();
      }

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/desktop-build-review-filled-1280.png`,
        fullPage: true,
      });
    });
  });

  // ===== Mobile (390x884) =====
  test.describe('Mobile (390x884)', () => {
    test.use({ viewport: { width: 390, height: 884 } });

    test('mobile Builder layout', async ({ page }) => {
      await page.goto('/__visual/mobile-builder');
      await expect(page.locator('#builder-heading')).toContainText('PC Builder');
      await page.waitForTimeout(300);

      // Verify seven slots in list layout
      const slots = page.locator('[role="listitem"]');
      await expect(slots).toHaveCount(7);

      // Verify summary panel below slots
      const summaryPanel = page.locator('.summary-panel');
      await expect(summaryPanel).toBeVisible();

      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/mobile-builder-390.png`,
        fullPage: true,
      });
    });

    test('mobile Builder disabled controls', async ({ page }) => {
      await page.goto('/__visual/mobile-builder');
      await expect(page.locator('#builder-heading')).toContainText('PC Builder');
      await page.waitForTimeout(300);

      // Verify disabled buttons with reasons
      const buttons = page.locator('.summary-panel button');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < count; i++) {
        await expect(buttons.nth(i)).toBeDisabled();
      }

      // Verify action reasons are present
      const reasons = page.locator('.action-reason');
      const reasonCount = await reasons.count();
      expect(reasonCount).toBeGreaterThanOrEqual(2);
    });
  });
});
