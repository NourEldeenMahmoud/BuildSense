import { test, expect } from '@playwright/test';

test.describe('Application Shell - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('loads home page and shows desktop navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check main layout
    await expect(page.locator('main.app-main')).toBeVisible();
    
    // Check navigation
    const desktopNav = page.locator('.nav-links.desktop-only');
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.locator('a:has-text("Catalog")')).toBeVisible();
    
    // Mobile trigger should be hidden
    await expect(page.locator('.mobile-only button')).toBeHidden();

    // Check horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Capture screenshot
    await page.screenshot({ path: 'apps/web/e2e/screenshots/desktop-1280.png', fullPage: true });
  });

  test('1600px width test', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
    await page.screenshot({ path: 'apps/web/e2e/screenshots/desktop-1600.png', fullPage: true });
  });
});

test.describe('Application Shell - Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('handles mobile navigation keyboard flow', async ({ page }) => {
    await page.goto('/');
    
    // Desktop nav should be hidden
    await expect(page.locator('.nav-links.desktop-only')).toBeHidden();
    
    // Mobile trigger should be visible
    const triggerBtn = page.locator('.mobile-only button');
    await expect(triggerBtn).toBeVisible();

    // Check horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Capture closed mobile state
    await page.screenshot({ path: 'apps/web/e2e/screenshots/mobile-390-closed.png', fullPage: true });

    // Open mobile nav with keyboard
    await triggerBtn.focus();
    await page.keyboard.press('Enter');
    
    // Overlay should open
    const dialog = page.getByRole('dialog', { name: 'Mobile Navigation' });
    await expect(dialog).toBeVisible();

    // Capture open mobile state
    await page.screenshot({ path: 'apps/web/e2e/screenshots/mobile-390-open.png' });
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    
    // Focus should return to trigger
    await expect(triggerBtn).toBeFocused();
  });

  test('768px width test', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
    
    // At 768px, mobile nav is triggered (max-width: 768px in CSS)
    await expect(page.locator('.mobile-only button')).toBeVisible();
    await page.screenshot({ path: 'apps/web/e2e/screenshots/tablet-768.png', fullPage: true });
  });
});
